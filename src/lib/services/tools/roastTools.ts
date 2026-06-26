import { tool } from 'ai';
import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';
import { listRoasts, type RoastProfile } from '@purveyors/cli/roast';
import { positiveOrUndef } from './shared';

export function createRoastTools(supabase: SupabaseClient, userId: string) {
	return {
		roast_profiles: tool({
			description:
				"Get user's roast profiles with filtering, timing data, temperature milestones, and advanced analytics",
			inputSchema: z.object({
				roast_id: z.string().optional().describe('Specific roast ID'),
				roast_name: z.string().optional().describe('Search by roast name'),
				batch_name: z.string().optional().describe('Search by batch name'),
				coffee_id: z
					.number()
					.optional()
					.describe('Filter by green coffee inventory ID - use this for specific coffee analysis'),
				catalog_id: z
					.number()
					.optional()
					.describe(
						'Filter by catalog ID (use this when you have an ID from coffee_catalog_search)'
					),
				roast_date_start: z
					.string()
					.optional()
					.describe('Start date for date range filtering (YYYY-MM-DD format)'),
				roast_date_end: z
					.string()
					.optional()
					.describe('End date for date range filtering (YYYY-MM-DD format)'),
				limit: z.number().optional().default(10).describe('Number of results (max 15)'),
				include_calculations: z
					.boolean()
					.optional()
					.default(true)
					.describe('Include comprehensive summary statistics and analytics'),
				stocked_only: z
					.boolean()
					.optional()
					.default(true)
					.describe(
						'Only show roasts for currently stocked coffee (default: true, use false for historical analysis)'
					)
			}),
			execute: async (input) => {
				const finalLimit = Math.min(input.limit ?? 10, 15);

				// CLI listRoasts supports these filters server-side; roast_name and date range
				// are applied client-side after fetching.
				let profiles: RoastProfile[] = await listRoasts(supabase, userId, {
					coffee_id: positiveOrUndef(input.coffee_id),
					roast_id: positiveOrUndef(input.roast_id ? parseInt(input.roast_id, 10) : undefined),
					batch_name: input.batch_name,
					catalog_id: positiveOrUndef(input.catalog_id),
					stocked_only: input.stocked_only,
					limit: finalLimit * 3 // fetch more to allow for client-side filtering
				});

				// Client-side post-filters for params the CLI doesn't support server-side
				if (input.roast_name) {
					const nameLower = input.roast_name.toLowerCase();
					profiles = profiles.filter((p) => p.coffee_name?.toLowerCase().includes(nameLower));
				}

				if (input.roast_date_start) {
					profiles = profiles.filter(
						(p) => p.roast_date && p.roast_date >= input.roast_date_start!
					);
				}

				if (input.roast_date_end) {
					profiles = profiles.filter((p) => p.roast_date && p.roast_date <= input.roast_date_end!);
				}

				// Trim to requested limit after client-side filtering
				profiles = profiles.slice(0, finalLimit);

				// Add formatted time fields so LLM sees "7:07" not raw seconds
				const formatTime = (seconds: number | null | undefined): string | null => {
					if (seconds == null) return null;
					const m = Math.floor(seconds / 60);
					const s = Math.floor(seconds % 60);
					return `${m}:${s.toString().padStart(2, '0')}`;
				};

				const TIME_FIELDS = [
					'total_roast_time',
					'fc_start_time',
					'fc_end_time',
					'drop_time',
					'tp_time',
					'charge_time',
					'cool_time',
					'dry_end_time',
					'sc_start_time'
				] as string[];

				const profilesWithFmt = profiles.map((p) => {
					const extra: Record<string, string | null> = {};
					for (const field of TIME_FIELDS) {
						const val = (p as unknown as Record<string, unknown>)[field];
						extra[`${field}_fmt`] = formatTime(typeof val === 'number' ? val : null);
					}
					return { ...p, ...extra };
				});

				return {
					profiles: profilesWithFmt,
					total: profilesWithFmt.length,
					filters_applied: input
				};
			}
		}),

		create_roast_session: tool({
			description:
				'Propose creating a new roast session/profile. The user can then fill in details after executing.',
			inputSchema: z.object({
				coffee_id: z.number().describe('Green coffee inventory ID'),
				coffee_name: z.string().describe('Coffee name for the batch'),
				batch_name: z.string().describe('Batch name'),
				roast_date: z.string().optional().describe('Roast date (YYYY-MM-DD)'),
				oz_in: z.number().optional().describe('Weight in (oz)'),
				roast_notes: z.string().optional().describe('Roast notes or targets'),
				roaster_type: z.string().optional().describe('Roaster type'),
				reasoning: z
					.string()
					.optional()
					.describe('Brief explanation of why this roast session is proposed')
			}),
			execute: async (input) => {
				// When user confirms the action_card, execute-action should call:
				//   createRoast(supabase, userId, {
				//     coffeeId: params.coffee_id,
				//     batchName: params.batch_name,
				//     ozIn: params.oz_in,
				//     roastDate: params.roast_date,
				//     notes: params.roast_notes,
				//   })
				if (!input.coffee_id || input.coffee_id <= 0) {
					return {
						error:
							'coffee_id is required and must be a positive integer. Please specify which inventory coffee to create a roast session for.'
					};
				}
				return {
					action_card: {
						actionType: 'create_roast_session',
						summary: `Create roast session: ${input.batch_name} (${input.coffee_name})`,
						reasoning: input.reasoning,
						fields: [
							{
								key: 'coffee_id',
								label: 'Coffee ID',
								value: input.coffee_id,
								type: 'number',
								editable: false
							},
							{
								key: 'coffee_name',
								label: 'Coffee Name',
								value: input.coffee_name,
								type: 'text',
								editable: true
							},
							{
								key: 'batch_name',
								label: 'Batch Name',
								value: input.batch_name,
								type: 'text',
								editable: true
							},
							{
								key: 'roast_date',
								label: 'Roast Date',
								value: input.roast_date || new Date().toISOString().split('T')[0],
								type: 'date',
								editable: true
							},
							...(input.oz_in != null
								? [
										{
											key: 'oz_in',
											label: 'Weight In (oz)',
											value: input.oz_in,
											type: 'number',
											editable: true
										}
									]
								: []),
							...(input.roast_notes
								? [
										{
											key: 'roast_notes',
											label: 'Notes',
											value: input.roast_notes,
											type: 'textarea',
											editable: true
										}
									]
								: []),
							...(input.roaster_type
								? [
										{
											key: 'roaster_type',
											label: 'Roaster',
											value: input.roaster_type,
											type: 'text',
											editable: true
										}
									]
								: [])
						],
						status: 'proposed'
					}
				};
			}
		}),

		update_roast_notes: tool({
			description: 'Propose updating notes or targets on an existing roast profile.',
			inputSchema: z.object({
				roast_id: z.number().describe('Roast profile ID'),
				roast_notes: z.string().optional().describe('Updated roast notes'),
				roast_targets: z.string().optional().describe('Updated roast targets'),
				reasoning: z
					.string()
					.optional()
					.describe('Brief explanation of why these notes are proposed')
			}),
			execute: async (input) => {
				// No direct CLI equivalent yet — execute-action uses Supabase directly:
				//   supabase.from('roast_profiles').update({ roast_notes, roast_targets })
				//     .eq('roast_id', params.roast_id).eq('user', userId)
				if (!input.roast_id || input.roast_id <= 0) {
					return {
						error:
							'roast_id is required and must be a positive integer. Please specify which roast profile to update.'
					};
				}
				return {
					action_card: {
						actionType: 'update_roast_notes',
						summary: `Update notes for roast #${input.roast_id}`,
						reasoning: input.reasoning,
						fields: [
							{
								key: 'roast_id',
								label: 'Roast ID',
								value: input.roast_id,
								type: 'number',
								editable: false
							},
							...(input.roast_notes != null
								? [
										{
											key: 'roast_notes',
											label: 'Roast Notes',
											value: input.roast_notes,
											type: 'textarea',
											editable: true
										}
									]
								: []),
							...(input.roast_targets != null
								? [
										{
											key: 'roast_targets',
											label: 'Roast Targets',
											value: input.roast_targets,
											type: 'textarea',
											editable: true
										}
									]
								: [])
						],
						status: 'proposed'
					}
				};
			}
		})
	};
}
