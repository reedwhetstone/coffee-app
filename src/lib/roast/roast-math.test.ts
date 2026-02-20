import { describe, it, expect } from 'vitest';
import {
	msToSeconds,
	secondsToMs,
	formatTimeDisplay,
	chargeRelativeMinutes,
	fahrenheitToCelsius,
	celsiusToFahrenheit,
	smoothData,
	calculateRoR,
	extractMilestones,
	calculatePhasePercentages,
	findChargeTime,
	normalizeEventName,
	formatDisplayName,
	mapControlName,
	calculateRoRAtPoint
} from './roast-math';
import type { RoastPoint, RoastEventEntry } from './roast-types';

// ─── Time Utilities ──────────────────────────────────────────────────────────

describe('msToSeconds', () => {
	it('converts milliseconds to seconds', () => {
		expect(msToSeconds(1000)).toBe(1);
		expect(msToSeconds(60000)).toBe(60);
		expect(msToSeconds(0)).toBe(0);
		expect(msToSeconds(500)).toBe(0.5);
	});
});

describe('secondsToMs', () => {
	it('converts seconds to milliseconds', () => {
		expect(secondsToMs(1)).toBe(1000);
		expect(secondsToMs(60)).toBe(60000);
		expect(secondsToMs(0)).toBe(0);
	});
});

describe('formatTimeDisplay', () => {
	it('formats milliseconds to MM:SS', () => {
		expect(formatTimeDisplay(60000)).toBe('1:00');
		expect(formatTimeDisplay(90000)).toBe('1:30');
		expect(formatTimeDisplay(600000)).toBe('10:00');
		expect(formatTimeDisplay(5000)).toBe('0:05');
	});

	it('returns --:-- for zero or negative', () => {
		expect(formatTimeDisplay(0)).toBe('--:--');
		expect(formatTimeDisplay(-1000)).toBe('--:--');
	});

	it('pads seconds with leading zero', () => {
		expect(formatTimeDisplay(3000)).toBe('0:03');
		expect(formatTimeDisplay(9000)).toBe('0:09');
	});
});

describe('chargeRelativeMinutes', () => {
	it('calculates time relative to charge in minutes', () => {
		expect(chargeRelativeMinutes(120000, 60000)).toBe(1); // 1 minute after charge
		expect(chargeRelativeMinutes(60000, 60000)).toBe(0); // at charge
		expect(chargeRelativeMinutes(30000, 60000)).toBe(-0.5); // 30s before charge
	});
});

// ─── Temperature Utilities ───────────────────────────────────────────────────

describe('fahrenheitToCelsius', () => {
	it('converts common roast temperatures', () => {
		expect(fahrenheitToCelsius(212)).toBe(100);
		expect(fahrenheitToCelsius(32)).toBe(0);
		expect(fahrenheitToCelsius(400)).toBe(204.44);
	});
});

describe('celsiusToFahrenheit', () => {
	it('converts common roast temperatures', () => {
		expect(celsiusToFahrenheit(100)).toBe(212);
		expect(celsiusToFahrenheit(0)).toBe(32);
		expect(celsiusToFahrenheit(200)).toBe(392);
	});
});

// ─── Smoothing ───────────────────────────────────────────────────────────────

describe('smoothData', () => {
	it('returns empty array for empty input', () => {
		expect(smoothData([], 5)).toEqual([]);
	});

	it('returns original data for window size 1', () => {
		const data = [
			{ time: 0, value: 100 },
			{ time: 1, value: 200 },
			{ time: 2, value: 300 }
		];
		const result = smoothData(data, 1);
		expect(result).toEqual(data);
	});

	it('smooths values with sliding window average', () => {
		const data = [
			{ time: 0, value: 100 },
			{ time: 1, value: 200 },
			{ time: 2, value: 300 },
			{ time: 3, value: 200 },
			{ time: 4, value: 100 }
		];
		const result = smoothData(data, 3);

		// Middle point (index 2): average of 200, 300, 200 = 233.33
		expect(result[2].value).toBeCloseTo(233.33, 1);
		// Preserves time values
		expect(result[2].time).toBe(2);
	});

	it('handles edge points correctly with smaller window', () => {
		const data = [
			{ time: 0, value: 100 },
			{ time: 1, value: 200 },
			{ time: 2, value: 300 }
		];
		const result = smoothData(data, 3);

		// First point: average of [100, 200] = 150 (only 2 elements in window)
		expect(result[0].value).toBeCloseTo(150, 1);
	});
});

// ─── Rate of Rise ────────────────────────────────────────────────────────────

describe('calculateRoR', () => {
	it('returns empty for insufficient data', () => {
		const data: RoastPoint[] = [
			{ time: 0, heat: 0, fan: 0, bean_temp: 200 },
			{ time: 1000, heat: 0, fan: 0, bean_temp: 210 }
		];
		expect(calculateRoR(data, 0, null, 3, 3)).toEqual([]);
	});

	it('calculates positive RoR for rising temperatures', () => {
		// Generate 20 points with linear temperature rise: 200°F to 400°F over 10 minutes
		const data: RoastPoint[] = Array.from({ length: 20 }, (_, i) => ({
			time: i * 30000, // 30 seconds apart
			heat: 5,
			fan: 5,
			bean_temp: 200 + i * 10 // 10°F every 30 seconds = 20°F/min
		}));

		const result = calculateRoR(data, 0, null, 5, 3);
		expect(result.length).toBeGreaterThan(0);

		// All RoR values should be positive
		for (const point of result) {
			expect(point.value).toBeGreaterThan(0);
		}
	});

	it('filters by charge and drop time', () => {
		const data: RoastPoint[] = Array.from({ length: 30 }, (_, i) => ({
			time: i * 30000,
			heat: 5,
			fan: 5,
			bean_temp: 200 + i * 10
		}));

		const chargeTime = 60000; // 1 minute
		const dropTime = 600000; // 10 minutes

		const result = calculateRoR(data, chargeTime, dropTime, 5, 3);

		// All points should be within charge-drop range
		for (const point of result) {
			expect(point.time).toBeGreaterThanOrEqual(chargeTime);
			expect(point.time).toBeLessThanOrEqual(dropTime);
		}
	});
});

// ─── Milestones ──────────────────────────────────────────────────────────────

describe('extractMilestones', () => {
	const makeEvent = (name: string, timeSec: number): RoastEventEntry => ({
		roast_id: 1,
		time_seconds: timeSec,
		event_type: 10,
		event_value: null,
		event_string: name,
		category: 'milestone',
		subcategory: 'roast_phase',
		user_generated: true,
		automatic: false
	});

	it('extracts all milestone types', () => {
		const events = [
			makeEvent('charge', 0),
			makeEvent('dry_end', 180),
			makeEvent('fc_start', 360),
			makeEvent('drop', 540)
		];

		const milestones = extractMilestones(events);
		expect(milestones.charge).toBe(0);
		expect(milestones.maillard).toBe(180000); // converted to ms
		expect(milestones.fc_start).toBe(360000);
		expect(milestones.drop).toBe(540000);
	});

	it('handles alternative naming conventions', () => {
		const events = [
			makeEvent('start', 0),
			makeEvent('maillard', 180),
			makeEvent('cool', 600)
		];

		const milestones = extractMilestones(events);
		expect(milestones.start).toBe(0);
		expect(milestones.maillard).toBe(180000);
		expect(milestones.end).toBe(600000);
	});

	it('ignores non-milestone events', () => {
		const events: RoastEventEntry[] = [
			{
				roast_id: 1,
				time_seconds: 0,
				event_type: 1,
				event_value: '5',
				event_string: 'fan_setting',
				category: 'control',
				subcategory: 'machine_setting',
				user_generated: true,
				automatic: false
			}
		];

		const milestones = extractMilestones(events);
		expect(Object.keys(milestones).length).toBe(0);
	});

	it('returns empty object for empty events', () => {
		expect(extractMilestones([])).toEqual({});
	});
});

describe('calculatePhasePercentages', () => {
	it('calculates correct phase percentages for a typical roast', () => {
		// 9 minute roast: charge=0, dry_end=3min, fc=6min, drop=9min
		const milestones = {
			charge: 0,
			maillard: 180000,  // 3 min
			fc_start: 360000,  // 6 min
			drop: 540000       // 9 min
		};

		const result = calculatePhasePercentages(milestones);
		expect(result.totalTime).toBe(540000);
		expect(result.dryingPercent).toBeCloseTo(33.33, 1);
		expect(result.maillardPercent).toBeCloseTo(33.33, 1);
		expect(result.devPercent).toBeCloseTo(33.33, 1);
	});

	it('handles missing milestones gracefully', () => {
		const milestones = { charge: 0, drop: 540000 };
		const result = calculatePhasePercentages(milestones);
		expect(result.totalTime).toBe(540000);
		expect(result.dryingPercent).toBe(0);
		expect(result.maillardPercent).toBe(0);
		expect(result.devPercent).toBe(0);
	});

	it('uses currentTime for live roasts', () => {
		const milestones = {
			charge: 0,
			maillard: 180000,
			fc_start: 360000
		};
		// Live roast at 7 minutes, no drop yet
		const result = calculatePhasePercentages(milestones, 420000);
		expect(result.totalTime).toBe(420000);
		expect(result.devPercent).toBeCloseTo(14.29, 1); // 1 min dev / 7 min total
	});

	it('returns relative times for milestone displays', () => {
		const milestones = {
			charge: 60000, // charge at 1 min
			maillard: 240000, // dry end at 4 min
			fc_start: 420000, // FC at 7 min
			drop: 600000 // drop at 10 min
		};

		const result = calculatePhasePercentages(milestones);
		expect(result.tpTime).toBe(180000); // 3 min relative to charge
		expect(result.fcTime).toBe(360000); // 6 min relative to charge
	});
});

// ─── Charge Time Detection ───────────────────────────────────────────────────

describe('findChargeTime', () => {
	const makeEvent = (name: string, timeSec: number): RoastEventEntry => ({
		roast_id: 1,
		time_seconds: timeSec,
		event_type: 10,
		event_value: null,
		event_string: name,
		category: 'milestone',
		subcategory: 'roast_phase',
		user_generated: true,
		automatic: false
	});

	it('prefers charge event from milestones', () => {
		const events = [makeEvent('charge', 30), makeEvent('start', 0)];
		const data: RoastPoint[] = [{ time: 0, heat: 0, fan: 0, charge: true }];

		expect(findChargeTime(events, data)).toBe(30000);
	});

	it('falls back to start event if no charge', () => {
		const events = [makeEvent('start', 10)];
		expect(findChargeTime(events, [])).toBe(10000);
	});

	it('falls back to data point charge flag', () => {
		const data: RoastPoint[] = [
			{ time: 5000, heat: 0, fan: 0, charge: false },
			{ time: 15000, heat: 0, fan: 0, charge: true, data_source: 'artisan_import' }
		];
		expect(findChargeTime([], data)).toBe(15000);
	});

	it('falls back to first data point', () => {
		const data: RoastPoint[] = [
			{ time: 2000, heat: 0, fan: 0 },
			{ time: 5000, heat: 0, fan: 0 }
		];
		expect(findChargeTime([], data)).toBe(2000);
	});

	it('returns 0 when nothing is available', () => {
		expect(findChargeTime([], [])).toBe(0);
	});
});

// ─── Event Name Formatting ───────────────────────────────────────────────────

describe('normalizeEventName', () => {
	it('lowercases and replaces spaces with underscores', () => {
		expect(normalizeEventName('FC Start')).toBe('fc_start');
		expect(normalizeEventName('Dry End')).toBe('dry_end');
		expect(normalizeEventName('Drop')).toBe('drop');
	});
});

describe('formatDisplayName', () => {
	it('converts underscored names to Title Case', () => {
		expect(formatDisplayName('fc_start')).toBe('Fc Start');
		expect(formatDisplayName('dry_end')).toBe('Dry End');
		expect(formatDisplayName('drop')).toBe('Drop');
	});
});

describe('mapControlName', () => {
	it('maps Artisan control names to standard names', () => {
		expect(mapControlName('burner')).toBe('heat');
		expect(mapControlName('air')).toBe('fan');
	});

	it('returns original name for unknown mappings', () => {
		expect(mapControlName('fan_setting')).toBe('fan_setting');
		expect(mapControlName('custom_control')).toBe('custom_control');
	});
});

// ─── RoR at Point ────────────────────────────────────────────────────────────

describe('calculateRoRAtPoint', () => {
	const data = Array.from({ length: 20 }, (_, i) => ({
		time: i * 30000, // 30s intervals
		bean_temp: 200 + i * 10 as number | null // 10°F per 30s = 20°F/min
	}));

	it('returns null for early indices', () => {
		expect(calculateRoRAtPoint(data, 0)).toBeNull();
		expect(calculateRoRAtPoint(data, 4)).toBeNull();
	});

	it('calculates RoR at valid index', () => {
		const result = calculateRoRAtPoint(data, 10);
		expect(result).not.toBeNull();
		expect(result!).toBeGreaterThan(0);
	});

	it('returns null for null bean temp', () => {
		const dataWithNull = [...data];
		dataWithNull[10] = { time: 300000, bean_temp: null };
		expect(calculateRoRAtPoint(dataWithNull, 10)).toBeNull();
	});
});
