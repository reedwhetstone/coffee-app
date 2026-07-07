export type AnalyticsSurface =
	| 'market-index'
	| 'catalog'
	| 'portfolio'
	| 'roast'
	| 'profit'
	| 'api-console'
	| 'chat-canvas';

export interface InsightModuleContract {
	id: string;
	surface: AnalyticsSurface;
	userQuestion: string;
	decision: string;
	overview: string;
	anomaly: string;
	explanation: string;
	source: string;
	primaryAction: string;
	desktopRepresentation: string;
	mobileRepresentation: string;
	qaTask: string;
}

export const MARKET_INDEX_MODULES = {
	marketRead: {
		id: 'market-read',
		surface: 'market-index',
		userQuestion: 'What is the market doing today?',
		decision: 'Choose the market scope and movement window to investigate.',
		overview: 'A headline read summarizes price posture, availability, and confidence.',
		anomaly: 'Lead movement, availability pressure, or thin supplier coverage is surfaced first.',
		explanation: 'The read separates market movement from the evidence quality behind it.',
		source: 'Latest daily-normalized price snapshot, movement window, and supplier counts.',
		primaryAction: 'Set scope, then ask chat with the current context or inspect evidence below.',
		desktopRepresentation: 'Headline, explanation, and global controls side by side.',
		mobileRepresentation: 'Headline first, then stacked scope controls and evidence path.',
		qaTask:
			'Mobile: identify the latest market read, switch scope, then continue to the evidence section.'
	},
	valueSignals: {
		id: 'value-signals',
		surface: 'market-index',
		userQuestion: 'What should I consider buying?',
		decision: 'Open a lot whose price signal has enough evidence to inspect.',
		overview: 'Top buy signals summarize price drops and below-market lots.',
		anomaly: 'The strongest scoped value signals appear before broader chart evidence.',
		explanation: 'Each signal explains whether it is cheap versus itself or its segment.',
		source: 'Signal feed date, market scope, supplier listing, and segment evidence.',
		primaryAction: 'View the selected coffee in the catalog.',
		desktopRepresentation: 'Multi-column signal card grid.',
		mobileRepresentation: 'Stacked signal cards with evidence and catalog action kept together.',
		qaTask: 'Mobile: find one value signal, read its evidence, and open the catalog action.'
	},
	valueSignalsPublic: {
		id: 'value-signals-public',
		surface: 'market-index',
		userQuestion: 'What buying pressure is visible before upgrading?',
		decision: 'Decide whether the aggregate signal count is worth unlocking lot-level evidence.',
		overview: 'Public readers see aggregate buy-signal counts and the proof slice available today.',
		anomaly:
			'The active count separates price drops from below-market lots without exposing supplier rows.',
		explanation:
			'The teaser shows that value signals exist while keeping lot-level leverage behind Intelligence.',
		source: 'Aggregate signal count, signal type totals, as-of date, and entitlement note.',
		primaryAction: 'Start Intelligence or sign in before inspecting named lots.',
		desktopRepresentation: 'Aggregate signal summary with upgrade and sign-in actions.',
		mobileRepresentation: 'Stacked summary with count, signal mix, entitlement note, and action.',
		qaTask:
			'Mobile: read the public signal count, confirm the entitlement boundary, and reach the upgrade or sign-in action.'
	},
	todaySignals: {
		id: 'today-signals',
		surface: 'market-index',
		userQuestion: 'Which market change matters most today?',
		decision: 'Prioritize availability, price posture, or coverage before deep-diving.',
		overview: 'KPI and insight cards summarize movement, availability, and coverage.',
		anomaly: 'Arrivals, delistings, largest price moves, and thin-coverage origins are called out.',
		explanation: 'Cards interpret the latest counts instead of only listing metrics.',
		source: 'Daily snapshots, movement counts, current catalog totals, and supplier coverage.',
		primaryAction: 'Inspect the matching evidence chart or ask chat with context.',
		desktopRepresentation: 'KPI strip plus insight-card grid.',
		mobileRepresentation: 'Stacked KPI and insight cards ordered by priority.',
		qaTask: 'Mobile: identify the highest-priority signal and move to the source evidence.'
	},
	priceEvidence: {
		id: 'price-evidence',
		surface: 'market-index',
		userQuestion: 'What evidence explains the market read?',
		decision: 'Judge whether price movement is broad, origin-specific, or composition-driven.',
		overview: 'Origin trend, processing mix, and origin range summaries frame the chart evidence.',
		anomaly:
			'Thin data, unusual origin spread, and process mix shifts need to be visible before density.',
		explanation: 'Charts back the market read with scope-aware price and composition context.',
		source: 'Price index snapshots, stocked catalog composition, and origin price ranges.',
		primaryAction: 'Expand charts for density or continue to supplier movement.',
		desktopRepresentation: 'Expandable charts with longer-horizon controls for entitled users.',
		mobileRepresentation: 'Compact summaries before each chart, with expansion for density.',
		qaTask: 'Mobile: read one chart summary, inspect its source note, then expand the chart.'
	},
	metadataTrends: {
		id: 'metadata-trends',
		surface: 'market-index',
		userQuestion: 'How is the offer-list mix changing beyond price?',
		decision: 'Decide whether process mix or disclosure quality is moving enough to investigate.',
		overview: 'Metadata trend summaries describe process and transparency changes over time.',
		anomaly: 'Scope mismatch and disclosure shifts are explicit before the charts.',
		explanation: 'The module treats metadata as its own market index, not just decoration.',
		source: 'Monthly metadata index snapshots for stocked retail supply.',
		primaryAction: 'Upgrade for disclosure depth or ask chat about the current trend.',
		desktopRepresentation: 'Composition trend charts for process and disclosure series.',
		mobileRepresentation: 'Stacked trend summaries followed by one chart at a time.',
		qaTask:
			'Mobile: identify whether the metadata trend follows the selected scope and inspect one source note.'
	},
	supplierMovement: {
		id: 'supplier-movement',
		surface: 'market-index',
		userQuestion: 'Which suppliers and lots explain the move?',
		decision: 'Compare supplier price ranges, arrivals, delistings, and origin benchmarks.',
		overview: 'Supplier comparison and movement panels summarize who has what and what changed.',
		anomaly:
			'Cheapest supplier ranges, new arrivals, delistings, and truncated movement rows are explicit.',
		explanation: 'Supplier-level evidence turns the aggregate read into a sourcing investigation.',
		source: 'Supplier price ranges, comparison rows, movement counts, and origin benchmarks.',
		primaryAction: 'Expand the relevant panel and open catalog or chat for the next step.',
		desktopRepresentation: 'Expandable chart/table panels with high-density supplier views.',
		mobileRepresentation:
			'Summary cards and drill-in panels, with tables retained as deep density.',
		qaTask:
			'Mobile: inspect one supplier or movement anomaly and reach its evidence without horizontal scrolling.'
	},
	supplierMovementPublic: {
		id: 'supplier-movement-public',
		surface: 'market-index',
		userQuestion: 'What supplier depth is available if this read matters?',
		decision: 'Decide whether supplier-level price and movement evidence is worth unlocking.',
		overview: 'Public readers see the supplier layer described as gated Intelligence depth.',
		anomaly:
			'The module does not expose named suppliers, arrivals, delistings, or origin benchmarks publicly.',
		explanation:
			'The teaser keeps the aggregate read honest and points to the deeper supplier investigation path.',
		source: 'Parchment Intelligence entitlement boundary and public proof-level market read.',
		primaryAction: 'Start Intelligence or review plans before opening supplier evidence.',
		desktopRepresentation: 'Gated supplier-depth summary beside plan actions.',
		mobileRepresentation: 'Stacked entitlement summary followed by upgrade or plan actions.',
		qaTask:
			'Mobile: confirm supplier evidence is gated, then reach the Intelligence or plans action.'
	}
} as const satisfies Record<string, InsightModuleContract>;

export const MARKET_INDEX_MODULE_LIST = Object.values(MARKET_INDEX_MODULES);
