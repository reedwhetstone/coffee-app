import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRoastSession } from './roast-session.svelte';
import type { RoastTimer } from './roast-timer.svelte';

/**
 * Session tests verify data management logic:
 * - Event creation (milestones, controls)
 * - Data loading for saved roasts
 * - Reset behavior
 * - Interval lifecycle (start/pause/resume/destroy)
 *
 * Note: $derived reactivity (chartData, milestones) requires Svelte's
 * rendering runtime. These tests verify the imperative API.
 */

// Create a mock timer for testing
function createMockTimer(overrides: Partial<RoastTimer> = {}): RoastTimer {
	return {
		elapsed: 0,
		seconds: 0,
		milliseconds: 0,
		phase: 'idle',
		isRunning: false,
		isPaused: false,
		isIdle: true,
		isCompleted: false,
		formattedTime: '0:00.00',
		start: vi.fn(),
		pause: vi.fn(),
		resume: vi.fn(),
		stop: vi.fn(),
		reset: vi.fn(),
		destroy: vi.fn(),
		...overrides
	};
}

beforeEach(() => {
	vi.useFakeTimers();
});

afterEach(() => {
	vi.useRealTimers();
});

describe('createRoastSession', () => {
	describe('initial state', () => {
		it('starts with empty data', () => {
			const session = createRoastSession();
			expect(session.temperatureEntries).toEqual([]);
			expect(session.eventEntries).toEqual([]);
			expect(session.fanValue).toBe(0);
			expect(session.heatValue).toBe(0);
			expect(session.roastId).toBe(0);
		});
	});

	describe('start', () => {
		it('creates initial start event and temperature entry', () => {
			const session = createRoastSession();
			const timer = createMockTimer({ isRunning: true, elapsed: 0 });

			session.start(timer, 42);

			expect(session.roastId).toBe(42);
			expect(session.eventEntries).toHaveLength(1);
			expect(session.eventEntries[0].event_string).toBe('start');
			expect(session.eventEntries[0].category).toBe('milestone');
			expect(session.eventEntries[0].roast_id).toBe(42);

			expect(session.temperatureEntries).toHaveLength(1);
			expect(session.temperatureEntries[0].time_seconds).toBe(0);
			expect(session.temperatureEntries[0].data_source).toBe('live');
		});

		it('starts data logging interval', () => {
			const session = createRoastSession();
			const timer = createMockTimer({ isRunning: true, elapsed: 5000 });

			session.start(timer, 1);

			// Advance past one logging interval (2 seconds)
			vi.advanceTimersByTime(2100);

			// The session should have logged data (but we can't easily
			// check liveRoastData due to $state - we verify via reset)
			session.destroy();
		});
	});

	describe('logMilestone', () => {
		it('adds a milestone event with control snapshots', () => {
			const session = createRoastSession();
			const timer = createMockTimer({ isRunning: true });
			session.start(timer, 1);

			session.setFan(5);
			session.setHeat(8);
			session.logMilestone('charge', 30000); // 30 seconds

			// Start event (1) + milestone (1) + 2 control events = 4
			expect(session.eventEntries).toHaveLength(4);

			const milestone = session.eventEntries[1];
			expect(milestone.event_string).toBe('charge');
			expect(milestone.category).toBe('milestone');
			expect(milestone.time_seconds).toBe(30);

			const fanEvent = session.eventEntries[2];
			expect(fanEvent.event_string).toBe('fan_setting');
			expect(fanEvent.event_value).toBe('5');

			const heatEvent = session.eventEntries[3];
			expect(heatEvent.event_string).toBe('heat_setting');
			expect(heatEvent.event_value).toBe('8');
		});

		it('sets heat to 0 on drop event', () => {
			const session = createRoastSession();
			const timer = createMockTimer({ isRunning: true });
			session.start(timer, 1);

			session.setHeat(9);
			session.logMilestone('drop', 600000);

			const heatEvent = session.eventEntries.find(
				(e) => e.event_string === 'heat_setting' && e.time_seconds === 600
			);
			expect(heatEvent?.event_value).toBe('0');
		});
	});

	describe('logControl', () => {
		it('adds a control event and updates state', () => {
			const session = createRoastSession();
			const timer = createMockTimer({ isRunning: true });
			session.start(timer, 1);

			session.logControl('fan', 7, 15000);

			expect(session.fanValue).toBe(7);

			const fanEvents = session.eventEntries.filter((e) => e.event_string === 'fan_setting');
			expect(fanEvents).toHaveLength(1);
			expect(fanEvents[0].event_value).toBe('7');
			expect(fanEvents[0].time_seconds).toBe(15);
		});

		it('handles heat control changes', () => {
			const session = createRoastSession();
			const timer = createMockTimer({ isRunning: true });
			session.start(timer, 1);

			session.logControl('heat', 4, 10000);
			expect(session.heatValue).toBe(4);
		});
	});

	describe('loadSavedData', () => {
		it('loads temperature and event data for viewing', () => {
			const session = createRoastSession();

			const temps = [
				{
					roast_id: 5,
					time_seconds: 0,
					bean_temp: 200,
					environmental_temp: 350,
					ambient_temp: null,
					ror_bean_temp: null,
					data_source: 'artisan_import' as const
				},
				{
					roast_id: 5,
					time_seconds: 60,
					bean_temp: 300,
					environmental_temp: 400,
					ambient_temp: null,
					ror_bean_temp: null,
					data_source: 'artisan_import' as const
				}
			];

			const events = [
				{
					roast_id: 5,
					time_seconds: 0,
					event_type: 10,
					event_value: null,
					event_string: 'charge',
					category: 'milestone' as const,
					subcategory: 'roast_phase',
					user_generated: true,
					automatic: false
				}
			];

			session.loadSavedData(temps, events, 5);

			expect(session.roastId).toBe(5);
			expect(session.temperatureEntries).toHaveLength(2);
			expect(session.eventEntries).toHaveLength(1);
		});
	});

	describe('setFan / setHeat', () => {
		it('updates fan value without logging event', () => {
			const session = createRoastSession();
			session.setFan(3);
			expect(session.fanValue).toBe(3);
			expect(session.eventEntries).toHaveLength(0);
		});

		it('updates heat value without logging event', () => {
			const session = createRoastSession();
			session.setHeat(6);
			expect(session.heatValue).toBe(6);
			expect(session.eventEntries).toHaveLength(0);
		});
	});

	describe('reset', () => {
		it('clears all session state', () => {
			const session = createRoastSession();
			const timer = createMockTimer({ isRunning: true });
			session.start(timer, 42);
			session.setFan(5);
			session.setHeat(8);
			session.logMilestone('charge', 30000);

			session.reset();

			expect(session.temperatureEntries).toEqual([]);
			expect(session.eventEntries).toEqual([]);
			expect(session.fanValue).toBe(0);
			expect(session.heatValue).toBe(0);
			expect(session.roastId).toBe(0);
		});
	});

	describe('pauseLogging / resumeLogging', () => {
		it('stops and restarts the data logging interval', () => {
			const session = createRoastSession();
			const timer = createMockTimer({ isRunning: true, elapsed: 1000 });
			session.start(timer, 1);

			// Should have an interval running
			session.pauseLogging();
			// Interval cleared - no crash on further time advance
			vi.advanceTimersByTime(5000);

			session.resumeLogging();
			// Interval restarted
			vi.advanceTimersByTime(2100);

			session.destroy();
		});
	});

	describe('destroy', () => {
		it('cleans up intervals without resetting data', () => {
			const session = createRoastSession();
			const timer = createMockTimer({ isRunning: true });
			session.start(timer, 1);
			session.logMilestone('charge', 5000);

			session.destroy();

			// Data preserved after destroy
			expect(session.eventEntries.length).toBeGreaterThan(0);
			expect(session.roastId).toBe(1);
		});
	});
});
