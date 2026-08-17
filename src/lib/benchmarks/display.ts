import type { CoffeeBenchSubjectResult } from './coffeebench';

export function formatMetric(value: number | null, digits = 2): string {
	return value === null ? 'Unavailable' : value.toFixed(digits);
}

export function formatCount(value: number | null): string {
	return value === null ? 'Unavailable' : new Intl.NumberFormat('en-US').format(value);
}

export function formatPerTask(value: number | null): string {
	return value === null
		? 'Unavailable'
		: new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(value);
}

export function formatRate(value: number): string {
	return new Intl.NumberFormat('en-US', {
		style: 'percent',
		maximumFractionDigits: 1
	}).format(value);
}

export function formatUsd(value: string | null): string {
	if (value === null) return 'Unavailable';
	return `$${value}`;
}

export function formatDuration(value: number | null): string {
	if (value === null) return 'Unavailable';
	return value >= 1000 ? `${(value / 1000).toFixed(1)} s` : `${value} ms`;
}

export function qualitySummary(result: CoffeeBenchSubjectResult): string {
	if (
		result.rank === null ||
		result.quality_score === null ||
		result.quality_interval_95.lower === null ||
		result.quality_interval_95.upper === null
	) {
		return 'Ineligible or unobserved';
	}
	return `#${result.rank} · ${result.quality_score.toFixed(3)} (${result.quality_interval_95.lower.toFixed(3)}–${result.quality_interval_95.upper.toFixed(3)})`;
}
