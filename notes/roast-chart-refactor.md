# RoastChartInterface Refactor: GenUI-First Design

**Status:** Active; data-layer extraction Phase 0.0 complete (PRs #97-#102 merged Mar 2026).
**Created:** 2026-02-20
**Last updated:** 2026-03-15
**Source:** Originally 2,969-line monolith; now 621 lines at `src/routes/roast/RoastChartInterface.svelte`

---

## Current State (Mar 3)

RoastChartInterface is down to 621 lines and now operates as a thinner orchestration layer.

Recent milestones merged in coffee-app:

1. **D3→LayerCake migration complete** for roast and profit charts (PRs #35-#39)
2. **Shared roast data layer extracted** from RoastChartInterface (PR #46)
3. **Comprehensive roast-data unit tests added** (PR #49)

The chart stack is now centered on shared components and typed roast utilities instead of monolithic page logic.

## Original State (pre-refactor)

Was a 2,969-line monolith handling:

1. **D3 chart rendering** ✅ EXTRACTED (LayerCake, PR #35)
2. **Real-time timer** ✅ EXTRACTED (createRoastTimer module, PR #31)
3. **Milestone tracking** (charge, dry end, FC start, FC end, SC start, drop, cool end; phase percentage calculations)
4. **Roast controls** (fan/heat sliders, event logging buttons)
5. **Data loading** (saved roast data fetching, chart settings persistence, Artisan import)
6. **Data transformation** (smoothing, RoR calculation, charge-relative time, event value normalization)
7. **Tooltip system** (hover state, multi-value display, milestone annotations)
8. **Chart settings** (axis bounds, zoom, display toggles)

## GenUI Context

The GenUI type system already defines:

- `RoastChartBlock { type: 'roast-chart', data: { roastId: number } }` — read-only chart for canvas
- `RoastFormBlock { type: 'roast-form', data: Partial<RoastFormData> }` — for creating/editing roast metadata
- `RoastComparisonBlock { type: 'roast-comparison', data: { roastIds: number[] } }` — multi-roast comparison
- `GenUIBlockRenderer.svelte` — already renders `RoastChartBlock` in both chat preview and canvas modes
- `RoastChartBlock.svelte` — existing GenUI canvas block (325 lines, read-only, fetches data via API)

The existing `RoastChartBlock` (GenUI) is already a clean, self-contained read-only chart. The problem is that the full roasting dashboard (with live recording, controls, milestones) is a separate 2,969-line monolith that shares zero code with it.

## Design Principles

1. **Every component must work in both page context AND GenUI canvas context.** A roast chart rendered in /roast should use the same D3 renderer as one shown on the canvas via chat.
2. **Pure data layer.** All data transformation, RoR calculation, and milestone math should be pure functions in a shared module. No data logic inside components.
3. **Components receive data as props, don't fetch it themselves.** The page or GenUI block handles data fetching; the component renders what it's given.
4. **Each component has a single responsibility** with a clear, typed API.

## Component Architecture

### Layer 1: Pure Functions (no Svelte, no DOM)

**`src/lib/roast/roast-math.ts`** — Pure roast calculation functions

- `smoothTemperatureData(data, windowSize)` — sliding window smoother
- `calculateRoR(points, chargeTime, dropTime)` — Rate of Rise from temp data
- `extractMilestones(events)` — milestone extraction from event entries (currently in stores.ts)
- `calculateMilestones(milestones, currentTime?)` — phase percentages (currently in stores.ts)
- `calculatePhasePercentages(milestones)` — drying/maillard/development
- `chargeRelativeTime(timeMs, chargeTime)` — milliseconds to charge-relative minutes
- `formatTimeDisplay(ms)` — time formatting (currently in stores.ts)
- `temperatureConvert(value, from, to)` — F/C conversion

**`src/lib/roast/roast-data.ts`** — Data fetching and transformation

- `fetchRoastChartData(roastId)` — API call for chart data
- `fetchRoastProfile(roastId)` — API call for profile metadata
- `convertToChartData(temperatures, events)` — normalize raw data to chart format (currently in stores.ts)
- `processArtisanImport(rawData)` — Artisan file data processing
- `buildEventValueSeries(events)` — transform control events to chart-renderable series

**`src/lib/roast/roast-types.ts`** — Shared type definitions

- Consolidate `RoastPoint`, `RoastEvent`, `TemperatureEntry`, `RoastEventEntry`, `MilestoneData`, `MilestoneCalculations`, chart config types
- Import from here everywhere instead of from stores.ts

### Layer 2: Headless State (Svelte runes, no DOM)

**`src/lib/roast/roast-timer.svelte.ts`** — Timer state machine

- `createRoastTimer()` returns reactive state: `{ elapsed, isRunning, isPaused, phase, start, pause, resume, stop, reset }`
- Phases: `idle` → `recording` → `paused` → `recording` → `completed`
- Manages `requestAnimationFrame` loop, accumulated time tracking
- No DOM, no UI; just reactive state that components consume

**`src/lib/roast/roast-session.svelte.ts`** — Session state management

- `createRoastSession(roastId?)` returns reactive state for a roasting session
- Manages: temperature entries, event entries, current fan/heat values, milestone state
- Methods: `addTemperatureReading()`, `logEvent()`, `logMilestone()`, `updateControl()`
- Coordinates between timer, data stores, and API persistence
- This replaces the writable stores in `routes/roast/stores.ts`

### Layer 3: Discrete UI Components

**`src/lib/components/roast/RoastChart.svelte`** — D3 chart renderer

- Props: `{ data: ChartPoint[], events: EventMarker[], milestones: MilestoneData, config?: ChartConfig }`
- Pure renderer: receives processed data, renders D3 chart
- Handles: temperature lines (BT, ET), RoR line, milestone markers, event value series, axes, legend
- Interactive: tooltip on hover, vertical indicator line
- Responsive: observes container size, redraws on resize
- **Works identically in /roast page and GenUI canvas.** The only difference is what data is passed and container size.

**`src/lib/components/roast/MilestoneBar.svelte`** — Phase visualization

- Props: `{ milestones: MilestoneCalculations, phase: RoastPhase }`
- Horizontal bar showing drying/maillard/development percentages
- Displays milestone timestamps and phase durations
- Works standalone in both page and canvas context

**`src/lib/components/roast/RoastControls.svelte`** — Live roasting controls

- Props: `{ fanValue, heatValue, onFanChange, onHeatChange, onLogEvent, phase, events }`
- Fan/heat sliders, milestone event buttons (Charge, Dry End, FC Start, etc.)
- Event feedback display
- **Page-only component** (not applicable to GenUI canvas read-only view)

**`src/lib/components/roast/RoastTooltip.svelte`** — Chart tooltip

- Props: `{ visible, position, data: TooltipData }`
- Displays time, BT, ET, RoR, event data, milestone annotations at cursor position
- Used by RoastChart internally

**`src/lib/components/roast/ArtisanImportDialog.svelte`** — Artisan file import

- Props: `{ roastId, onImportComplete }`
- File selection, preview, import execution
- Self-contained dialog (modal or slide-over)

**`src/lib/components/roast/RoastSummary.svelte`** — Roast summary card

- Props: `{ profile: RoastProfile, milestones: MilestoneCalculations }`
- Shows key metrics: total time, phase percentages, weight loss, temperatures
- Works in both page context and as a GenUI preview/canvas block

### Layer 4: Page Composition + GenUI Integration

**`src/routes/roast/RoastChartInterface.svelte`** — Page composer (REPLACED)

- Now a thin orchestration layer (~200-300 lines max)
- Creates a `roastSession` and `roastTimer`
- Passes reactive state down to child components
- Handles page-specific concerns (URL params, navigation, layout)

**`src/lib/components/genui/blocks/RoastChartBlock.svelte`** — GenUI canvas block (REWRITTEN)

- Fetches data via `fetchRoastChartData()`
- Renders using the SAME `RoastChart.svelte` + `MilestoneBar.svelte` + `RoastSummary.svelte`
- Read-only mode (no controls, no timer)
- Currently 325 lines of duplicated D3 code; after refactor, becomes ~50 lines of data-fetching + component composition

**`src/lib/components/genui/blocks/RoastComparisonBlock.svelte`** — NEW GenUI block

- Renders multiple `RoastChart.svelte` instances side-by-side
- `MilestoneBar` for each, comparison summary table

**`src/lib/components/genui/previews/RoastChartPreview.svelte`** — GenUI chat preview

- Compact card with key metrics from `RoastSummary` data
- Click-to-canvas action

## File Map (before → after)

```
BEFORE (1 file, 2,969 lines):
  src/routes/roast/RoastChartInterface.svelte    2,969 lines
  src/routes/roast/stores.ts                       ~300 lines (partial overlap)
  src/lib/components/genui/blocks/RoastChartBlock.svelte  325 lines (duplicated D3)

AFTER (~15 files, same total lines but properly factored):
  src/lib/roast/
  ├── roast-math.ts              ~200 lines (pure functions)
  ├── roast-data.ts              ~150 lines (data fetching + transform)
  ├── roast-types.ts             ~100 lines (shared types)
  ├── roast-timer.svelte.ts      ~80 lines (timer state machine)
  └── roast-session.svelte.ts    ~120 lines (session state)

  src/lib/components/roast/
  ├── RoastChart.svelte          ~600 lines (D3 renderer, single source)
  ├── MilestoneBar.svelte        ~100 lines
  ├── RoastControls.svelte       ~200 lines
  ├── RoastTooltip.svelte        ~80 lines
  ├── ArtisanImportDialog.svelte ~150 lines
  └── RoastSummary.svelte        ~80 lines

  src/routes/roast/
  └── RoastChartInterface.svelte ~250 lines (thin orchestration)

  src/lib/components/genui/blocks/
  └── RoastChartBlock.svelte     ~50 lines (reuses RoastChart)
```

## Testing Strategy

### Unit Tests (vitest, new)

- `roast-math.test.ts` — RoR calculation, milestone extraction, phase percentages, time formatting, temperature smoothing. Pure functions, easy to test exhaustively.
- `roast-data.test.ts` — data transformation (mock API responses → expected chart format)
- `roast-timer.test.ts` — timer state machine transitions (idle→recording→paused→recording→completed), elapsed time accuracy

### Component Tests (vitest + @testing-library/svelte, new)

- `RoastChart.test.ts` — renders with valid data, handles empty data, shows milestones, responsive resize
- `MilestoneBar.test.ts` — correct phase percentages, handles missing milestones
- `RoastControls.test.ts` — fan/heat changes fire callbacks, event buttons trigger logEvent
- `RoastSummary.test.ts` — displays correct metrics from props

### E2E Tests (Playwright, extend existing)

- Extend `crud.spec.ts` or create `roast-dashboard.spec.ts`
- Navigate to roast, verify chart renders, verify milestones display
- Test Artisan import flow
- Test saved roast loading
- Verify roast comparison view

All tests integrate with existing PR check pipeline (`pnpm test` runs vitest; Playwright runs E2E).

## Migration Plan Status

**Completed milestones**

- Phase 1: pure roast utility extraction (PR #22)
- Phase 2: headless timer/session modules (PRs #23-#24)
- Phase 3a-3f: component split + full D3→LayerCake migration (PRs #25, #31, #34, #35, #38, #39)
- Data-layer extraction from RoastChartInterface (PR #46)
- Roast-data unit test expansion (PR #49)

**Remaining focus**

- Continue reducing page-level orchestration logic where practical
- Expand integration/E2E coverage for full roast workflow and comparison flows
- Keep GenUI block reuse aligned with shared roast component APIs

**Tags:** #purveyors #refactor #svelte #active-project

## Links

- [[purveyors-blog]] — GenUI blog posts cover the canvas/chart architecture this refactor enables
