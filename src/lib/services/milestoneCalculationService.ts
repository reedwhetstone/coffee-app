/**
 * Milestone Calculation Service
 * Calculates roast milestones and phase data from roast_events table
 * and updates roast_profiles columns with computed values
 */

import type { SupabaseClient } from '@supabase/supabase-js';

export interface MilestoneData {
	charge_time?: number;
	dry_end_time?: number;
	fc_start_time?: number;
	fc_end_time?: number;
	sc_start_time?: number;
	drop_time?: number;
	cool_time?: number;
	charge_temp?: number;
	dry_end_temp?: number;
	fc_start_temp?: number;
	fc_end_temp?: number;
	sc_start_temp?: number;
	drop_temp?: number;
	cool_temp?: number;
}

export interface PhaseData {
	dry_percent?: number;
	maillard_percent?: number;
	development_percent?: number;
	total_roast_time?: number;
}

export interface CalculatedRoastData extends MilestoneData, PhaseData {
	weight_loss_percent?: number;
}

export class MilestoneCalculationService {
	constructor(private supabase: SupabaseClient) {}

	/**
	 * Calculate milestone data from roast_events for a specific roast
	 */
	async calculateMilestones(roastId: number): Promise<MilestoneData> {
		const { data: events, error } = await this.supabase
			.from('roast_events')
			.select('time_seconds, event_string, category')
			.eq('roast_id', roastId)
			.eq('category', 'milestone')
			.order('time_seconds', { ascending: true });

		if (error) {
			console.error('Error fetching milestone events:', error);
			throw new Error(`Failed to fetch milestone events: ${error.message}`);
		}

		const milestones: MilestoneData = {};

		// Get temperatures at milestone times by finding closest temperature reading
		for (const event of events || []) {
			const timeSeconds = parseFloat(String(event.time_seconds));
			if (isNaN(timeSeconds)) continue;

			// Get temperature reading closest to this milestone time
			const { data: tempData } = await this.supabase
				.from('roast_temperatures')
				.select('bean_temp')
				.eq('roast_id', roastId)
				.gte('time_seconds', timeSeconds - 2) // Within 2 seconds
				.lte('time_seconds', timeSeconds + 2)
				.order('time_seconds', { ascending: true })
				.limit(1);

			const temperature = tempData?.[0]?.bean_temp || null;

			// Map event strings to milestone fields
			switch (event.event_string) {
				case 'charge':
					milestones.charge_time = timeSeconds;
					milestones.charge_temp = temperature;
					break;
				case 'dry_end':
				case 'maillard':
					milestones.dry_end_time = timeSeconds;
					milestones.dry_end_temp = temperature;
					break;
				case 'fc_start':
					milestones.fc_start_time = timeSeconds;
					milestones.fc_start_temp = temperature;
					break;
				case 'fc_end':
					milestones.fc_end_time = timeSeconds;
					milestones.fc_end_temp = temperature;
					break;
				case 'sc_start':
					milestones.sc_start_time = timeSeconds;
					milestones.sc_start_temp = temperature;
					break;
				case 'drop':
					milestones.drop_time = timeSeconds;
					milestones.drop_temp = temperature;
					break;
				case 'cool':
				case 'end':
					milestones.cool_time = timeSeconds;
					milestones.cool_temp = temperature;
					break;
			}
		}

		return milestones;
	}

	/**
	 * Calculate phase percentages from milestone data
	 */
	calculatePhases(milestones: MilestoneData): PhaseData {
		const chargeTime = milestones.charge_time || 0;
		const dryEndTime = milestones.dry_end_time;
		const fcStartTime = milestones.fc_start_time;
		const dropTime = milestones.drop_time;
		const coolTime = milestones.cool_time;

		// Use drop_time or cool_time as end time
		const endTime = dropTime || coolTime;
		if (!endTime || endTime <= chargeTime) {
			return {}; // Can't calculate phases without valid end time
		}

		const totalTime = endTime - chargeTime;
		const phases: PhaseData = {
			total_roast_time: totalTime
		};

		// Calculate drying phase percentage
		if (dryEndTime && dryEndTime > chargeTime) {
			phases.dry_percent = ((dryEndTime - chargeTime) / totalTime) * 100;
		}

		// Calculate maillard phase percentage
		if (fcStartTime && dryEndTime && fcStartTime > dryEndTime) {
			phases.maillard_percent = ((fcStartTime - dryEndTime) / totalTime) * 100;
		}

		// Calculate development phase percentage
		if (fcStartTime && endTime > fcStartTime) {
			phases.development_percent = ((endTime - fcStartTime) / totalTime) * 100;
		}

		return phases;
	}

	/**
	 * Calculate weight loss percentage from oz_in and oz_out
	 */
	calculateWeightLoss(ozIn?: number, ozOut?: number): number | null {
		if (!ozIn || !ozOut || ozIn <= 0 || ozOut <= 0) {
			return null;
		}
		return ((ozIn - ozOut) / ozIn) * 100;
	}

	/**
	 * Get complete calculated data for a roast
	 */
	async getCalculatedRoastData(roastId: number): Promise<CalculatedRoastData> {
		// Get current roast profile data for oz_in/oz_out
		const { data: profile, error: profileError } = await this.supabase
			.from('roast_profiles')
			.select('oz_in, oz_out')
			.eq('roast_id', roastId)
			.single();

		if (profileError) {
			console.error('Error fetching roast profile:', profileError);
			throw new Error(`Failed to fetch roast profile: ${profileError.message}`);
		}

		// Calculate milestones and phases
		const milestones = await this.calculateMilestones(roastId);
		const phases = this.calculatePhases(milestones);
		const weightLoss = this.calculateWeightLoss(profile?.oz_in, profile?.oz_out);

		return {
			...milestones,
			...phases,
			weight_loss_percent: weightLoss ?? undefined
		};
	}

	/**
	 * Update roast_profiles table with calculated milestone data
	 */
	async updateRoastProfileMilestones(
		roastId: number,
		calculatedData?: CalculatedRoastData
	): Promise<void> {
		// Get calculated data if not provided
		const data = calculatedData || (await this.getCalculatedRoastData(roastId));

		// Filter out undefined values to avoid overwriting existing data with nulls
		const updateData = Object.fromEntries(
			Object.entries(data).filter(([_, value]) => value !== undefined && value !== null)
		);

		if (Object.keys(updateData).length === 0) {
			console.log(`No milestone data to update for roast ${roastId}`);
			return;
		}

		const { error } = await this.supabase
			.from('roast_profiles')
			.update(updateData)
			.eq('roast_id', roastId);

		if (error) {
			console.error('Error updating roast profile milestones:', error);
			throw new Error(`Failed to update roast profile milestones: ${error.message}`);
		}

		console.log(`Updated milestone data for roast ${roastId}:`, updateData);
	}

	/**
	 * Process all roast profiles with null milestone data
	 */
	async backfillNullMilestones(): Promise<{ processed: number; updated: number; errors: number }> {
		console.log('Starting backfill of null milestone data...');

		// Find roast profiles where milestone calculations are null
		const { data: profiles, error } = await this.supabase
			.from('roast_profiles')
			.select('roast_id')
			.or('dry_end_time.is.null,fc_start_time.is.null,development_percent.is.null')
			.order('roast_id', { ascending: true });

		if (error) {
			console.error('Error fetching profiles for backfill:', error);
			throw new Error(`Failed to fetch profiles for backfill: ${error.message}`);
		}

		const stats = { processed: 0, updated: 0, errors: 0 };

		for (const profile of profiles || []) {
			stats.processed++;
			try {
				const calculatedData = await this.getCalculatedRoastData(profile.roast_id);

				// Only update if we have meaningful data
				const hasData = Object.values(calculatedData).some(
					(value) => value !== null && value !== undefined
				);
				if (hasData) {
					await this.updateRoastProfileMilestones(profile.roast_id, calculatedData);
					stats.updated++;
				}
			} catch (error) {
				console.error(`Error processing roast ${profile.roast_id}:`, error);
				stats.errors++;
			}
		}

		console.log('Backfill complete:', stats);
		return stats;
	}
}

// Helper function to create service instance
export function createMilestoneCalculationService(
	supabase: SupabaseClient
): MilestoneCalculationService {
	return new MilestoneCalculationService(supabase);
}
