import { describe, expect, it } from 'vitest';
import { MARKET_INDEX_MODULE_LIST, MARKET_INDEX_MODULES } from './insightModules';

const REQUIRED_FIELDS = [
	'id',
	'surface',
	'userQuestion',
	'decision',
	'overview',
	'anomaly',
	'explanation',
	'source',
	'primaryAction',
	'desktopRepresentation',
	'mobileRepresentation',
	'qaTask'
] as const;

describe('Market Index insight module contracts', () => {
	it('defines the ADR-009 task parity contract for multiple Market Index modules', () => {
		expect(MARKET_INDEX_MODULE_LIST.length).toBeGreaterThanOrEqual(3);
		expect(MARKET_INDEX_MODULES.marketRead.surface).toBe('market-index');
		expect(MARKET_INDEX_MODULES.valueSignals.surface).toBe('market-index');
		expect(MARKET_INDEX_MODULES.priceEvidence.surface).toBe('market-index');

		for (const module of MARKET_INDEX_MODULE_LIST) {
			for (const field of REQUIRED_FIELDS) {
				expect(module[field], `${module.id}.${field}`).toEqual(expect.any(String));
				expect(module[field].trim().length, `${module.id}.${field}`).toBeGreaterThan(0);
			}
		}
	});

	it('keeps source, action, and QA fields decision-oriented', () => {
		for (const module of MARKET_INDEX_MODULE_LIST) {
			expect(module.source.toLowerCase()).toMatch(
				/snapshot|signal|supplier|catalog|movement|index|entitlement|proof/
			);
			expect(module.primaryAction.toLowerCase()).toMatch(
				/set|ask|view|inspect|expand|upgrade|open/
			);
			expect(module.qaTask).toMatch(/^Mobile:/);
		}
	});
});
