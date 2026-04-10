import type { Component } from 'svelte';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type DeferredAnalyticsComponent = Component<any>;

export async function loadPublicAnalyticsModules(): Promise<{
	OriginLineChartComponent: DeferredAnalyticsComponent;
	OriginBarChartComponent: DeferredAnalyticsComponent;
	ProcessDonutChartComponent: DeferredAnalyticsComponent;
}> {
	const [originLine, originBar, processDonut] = await Promise.all([
		import('$lib/components/analytics/OriginLineChart.svelte'),
		import('$lib/components/analytics/OriginBarChart.svelte'),
		import('$lib/components/analytics/ProcessDonutChart.svelte')
	]);

	return {
		OriginLineChartComponent: originLine.default,
		OriginBarChartComponent: originBar.default,
		ProcessDonutChartComponent: processDonut.default
	};
}

export async function loadSupplierAnalyticsModules(): Promise<{
	SupplierComparisonTableComponent: DeferredAnalyticsComponent;
	SupplierHealthTableComponent: DeferredAnalyticsComponent;
}> {
	const [comparisonTable, healthTable] = await Promise.all([
		import('$lib/components/analytics/SupplierComparisonTable.svelte'),
		import('$lib/components/analytics/SupplierHealthTable.svelte')
	]);

	return {
		SupplierComparisonTableComponent: comparisonTable.default,
		SupplierHealthTableComponent: healthTable.default
	};
}

export async function loadMemberAnalyticsModules(): Promise<{
	PriceTierChartComponent: DeferredAnalyticsComponent;
}> {
	const priceTierChart = await import('$lib/components/analytics/PriceTierChart.svelte');

	return {
		PriceTierChartComponent: priceTierChart.default
	};
}
