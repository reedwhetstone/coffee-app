<script lang="ts">
	import { onMount } from 'svelte';
	import 'maplibre-gl/dist/maplibre-gl.css';
	import maplibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
	import type {
		GeoJSONSource,
		Map as MapLibreMap,
		MapLayerMouseEvent,
		Popup as MapLibrePopup
	} from 'maplibre-gl';
	import {
		toCatalogMapGeoJson,
		type CatalogMapDisplayItem,
		type CatalogMapPointProperties
	} from '$lib/catalog/mapPresentation';
	import { MAP_SURFACE_COLORS, TERRAIN_ELEVATION_BANDS } from '$lib/styles/mapColors';
	import {
		normalizeCatalogMapLongitude,
		normalizeCatalogMapBounds,
		type CatalogMapBounds
	} from '$lib/catalog/mapState';

	export interface CatalogMapViewportChange {
		center: [number, number];
		zoom: number;
		bounds: CatalogMapBounds;
		commitSearch: boolean;
	}

	export interface CatalogMapClusterSelection {
		kind: 'area' | 'location';
		label: string;
		precisionLabel: string;
		mappedOriginCount: number;
		coffeeMatchCount: number;
		catalogIds: number[];
		originLabels: string[];
	}

	interface Props {
		items: CatalogMapDisplayItem[];
		center: [number, number];
		zoom: number;
		styleUrl?: string;
		onViewportChange: (viewport: CatalogMapViewportChange) => void;
		onPlaceSelect: (catalogId: number, placeId: string | null) => void;
		onClusterSelect?: (selection: CatalogMapClusterSelection) => void;
		onMapReady?: () => void;
		onMapError?: (message: string) => void;
	}

	let {
		items,
		center,
		zoom,
		styleUrl = 'https://tiles.openfreemap.org/styles/positron',
		onViewportChange,
		onPlaceSelect,
		onClusterSelect = () => {},
		onMapReady = () => {},
		onMapError = () => {}
	}: Props = $props();

	let container: HTMLDivElement;
	let map: MapLibreMap | null = null;
	let hoverPopup: MapLibrePopup | null = null;
	let hoverRequestVersion = 0;
	let sourceReady = $state(false);
	let destroyed = false;
	let resizeObserver: ResizeObserver | null = null;
	let resizeFrame: number | null = null;

	const TERRAIN_RELIEF_SOURCE_ID = 'catalog-terrain-dem';
	const TERRAIN_RELIEF_LAYER_ID = 'catalog-terrain-relief';
	const TERRAIN_RELIEF_TILES =
		'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png';
	const TERRAIN_RELIEF_ATTRIBUTION =
		'<a href="https://github.com/tilezen/joerd/blob/master/docs/attribution.md">Terrain: Mapzen and contributors</a>';

	const BASEMAP_PAINT_OVERRIDES = [
		['background', 'background-color', MAP_SURFACE_COLORS.canvas],
		['park', 'fill-color', MAP_SURFACE_COLORS.park],
		['water', 'fill-color', MAP_SURFACE_COLORS.water],
		['landuse_residential', 'fill-color', '#F1ECE6'],
		['landcover_wood', 'fill-color', '#E3E1D4'],
		['waterway', 'line-color', MAP_SURFACE_COLORS.waterway],
		['building', 'fill-color', '#ECE5DC'],
		['building', 'fill-outline-color', '#D8CEC2'],
		['highway_path', 'line-color', '#E7E0D8'],
		['highway_minor', 'line-color', '#DED6CD'],
		['highway_major_casing', 'line-color', '#D7CDC1'],
		['highway_major_inner', 'line-color', '#FFFDFB'],
		['highway_motorway_casing', 'line-color', '#D7CDC1'],
		['boundary_3', 'line-color', '#BAAFA3'],
		['boundary_2', 'line-color', '#BAAFA3'],
		['boundary_disputed', 'line-color', '#BAAFA3'],
		['water_name_point_label', 'text-color', MAP_SURFACE_COLORS.waterLabel],
		['water_name_point_label', 'text-halo-color', '#FCFAF8'],
		['water_name_line_label', 'text-color', MAP_SURFACE_COLORS.waterLabel],
		['water_name_line_label', 'text-halo-color', '#FCFAF8'],
		['label_other', 'text-color', '#695C4D'],
		['label_other', 'text-halo-color', '#FCFAF8'],
		['label_village', 'text-color', '#695C4D'],
		['label_village', 'text-halo-color', '#FCFAF8'],
		['label_town', 'text-color', '#302F2A'],
		['label_town', 'text-halo-color', '#FCFAF8'],
		['label_state', 'text-color', '#695C4D'],
		['label_state', 'text-halo-color', '#FCFAF8'],
		['label_city', 'text-color', '#302F2A'],
		['label_city', 'text-halo-color', '#FCFAF8'],
		['label_city_capital', 'text-color', '#302F2A'],
		['label_city_capital', 'text-halo-color', '#FCFAF8'],
		['label_country_3', 'text-color', '#302F2A'],
		['label_country_3', 'text-halo-color', '#FCFAF8'],
		['label_country_2', 'text-color', '#302F2A'],
		['label_country_2', 'text-halo-color', '#FCFAF8'],
		['label_country_1', 'text-color', '#302F2A'],
		['label_country_1', 'text-halo-color', '#FCFAF8']
	] as const;

	function applyPurveyorsBasemapTheme(currentMap: MapLibreMap) {
		for (const [layerId, property, color] of BASEMAP_PAINT_OVERRIDES) {
			if (currentMap.getLayer(layerId)) currentMap.setPaintProperty(layerId, property, color);
		}
	}

	function removeTerrainReliefLayer(currentMap: MapLibreMap) {
		if (currentMap.getLayer(TERRAIN_RELIEF_LAYER_ID)) {
			currentMap.removeLayer(TERRAIN_RELIEF_LAYER_ID);
		}
		if (currentMap.getSource(TERRAIN_RELIEF_SOURCE_ID)) {
			currentMap.removeSource(TERRAIN_RELIEF_SOURCE_ID);
		}
	}

	function addTerrainReliefLayer(currentMap: MapLibreMap) {
		try {
			if (!currentMap.getSource(TERRAIN_RELIEF_SOURCE_ID)) {
				currentMap.addSource(TERRAIN_RELIEF_SOURCE_ID, {
					type: 'raster-dem',
					tiles: [TERRAIN_RELIEF_TILES],
					tileSize: 256,
					maxzoom: 15,
					encoding: 'terrarium',
					attribution: TERRAIN_RELIEF_ATTRIBUTION
				});
			}
			if (currentMap.getLayer(TERRAIN_RELIEF_LAYER_ID)) return;

			currentMap.addLayer(
				{
					id: TERRAIN_RELIEF_LAYER_ID,
					type: 'color-relief',
					source: TERRAIN_RELIEF_SOURCE_ID,
					paint: {
						'color-relief-color': [
							'interpolate',
							['linear'],
							['elevation'],
							-1000,
							TERRAIN_ELEVATION_BANDS[0].color,
							999.9,
							TERRAIN_ELEVATION_BANDS[0].color,
							1000,
							TERRAIN_ELEVATION_BANDS[1].color,
							1399.9,
							TERRAIN_ELEVATION_BANDS[1].color,
							1400,
							TERRAIN_ELEVATION_BANDS[2].color,
							1799.9,
							TERRAIN_ELEVATION_BANDS[2].color,
							1800,
							TERRAIN_ELEVATION_BANDS[3].color,
							2199.9,
							TERRAIN_ELEVATION_BANDS[3].color,
							2200,
							TERRAIN_ELEVATION_BANDS[4].color,
							9000,
							TERRAIN_ELEVATION_BANDS[4].color
						],
						'color-relief-opacity': 0.48
					}
				},
				currentMap.getLayer('water') ? 'water' : 'catalog-map-clusters'
			);
		} catch {
			// Terrain is supplemental context. Preserve the catalog map if it is unavailable.
			removeTerrainReliefLayer(currentMap);
		}
	}

	function readProperties(event: MapLayerMouseEvent): Record<string, unknown> | null {
		const properties = event.features?.[0]?.properties;
		return properties ? (properties as Record<string, unknown>) : null;
	}

	function readPointProperties(event: MapLayerMouseEvent): CatalogMapPointProperties | null {
		const properties = readProperties(event);
		if (!properties || typeof properties.type !== 'string') return null;
		return properties as unknown as CatalogMapPointProperties;
	}

	function readCount(properties: Record<string, unknown>, key: string): number {
		const value = Number(properties[key]);
		return Number.isFinite(value) && value > 0 ? value : 1;
	}

	function readCatalogIds(value: unknown): number[] {
		let candidates: unknown[] = [];
		if (Array.isArray(value)) {
			candidates = value;
		} else if (typeof value === 'string') {
			try {
				const parsed = JSON.parse(value) as unknown;
				candidates = Array.isArray(parsed) ? parsed : value.split(',');
			} catch {
				candidates = value.split(',');
			}
		}
		return [
			...new Set(
				candidates
					.map((candidate) => Number(candidate))
					.filter((candidate) => Number.isSafeInteger(candidate) && candidate > 0)
			)
		].sort((left, right) => left - right);
	}

	function catalogIdsFromProperties(properties: Record<string, unknown>): number[] {
		const ids = readCatalogIds(properties.catalogIds);
		const catalogId = Number(properties.catalogId);
		if (Number.isSafeInteger(catalogId) && catalogId > 0) ids.push(catalogId);
		return [...new Set(ids)].sort((left, right) => left - right);
	}

	function labelFromProperties(properties: Record<string, unknown>): string | null {
		const label = properties.label;
		return typeof label === 'string' && label.trim() !== '' && label !== 'Mapped area'
			? label.trim()
			: null;
	}

	function coffeeCountLabel(count: number): string {
		return `${count.toLocaleString()} ${count === 1 ? 'coffee' : 'coffees'}`;
	}

	function createHoverContent(title: string, detail: string): HTMLDivElement {
		const content = document.createElement('div');
		content.className = 'catalog-map-hover-content';
		const heading = document.createElement('strong');
		heading.textContent = title;
		const description = document.createElement('span');
		description.textContent = detail;
		content.append(heading, description);
		return content;
	}

	function showHoverPopup(event: MapLayerMouseEvent, title: string, detail: string) {
		if (!map || !hoverPopup) return;
		hoverPopup.setLngLat(event.lngLat).setDOMContent(createHoverContent(title, detail)).addTo(map);
	}

	function hideHoverPopup() {
		hoverRequestVersion += 1;
		hoverPopup?.remove();
	}

	function handlePointHover(event: MapLayerMouseEvent) {
		const properties = readPointProperties(event);
		if (!properties) return;
		const title = labelFromProperties(properties as unknown as Record<string, unknown>);
		if (!title) return;
		showHoverPopup(
			event,
			title,
			`${properties.precisionLabel} · ${coffeeCountLabel(properties.uniqueCoffeeCount)}`
		);
	}

	async function handleVisualClusterHover(event: MapLayerMouseEvent) {
		const currentMap = map;
		const properties = readProperties(event);
		const clusterId = Number(properties?.cluster_id);
		if (!currentMap || !properties || !Number.isFinite(clusterId)) return;
		const source = currentMap.getSource('catalog-map') as GeoJSONSource | undefined;
		if (!source) return;
		const requestVersion = ++hoverRequestVersion;
		const leafLimit = Math.min(readCount(properties, 'point_count'), 25);
		try {
			const leaves = await source.getClusterLeaves(clusterId, leafLimit, 0);
			if (requestVersion !== hoverRequestVersion || map !== currentMap) return;
			const labels = [
				...new Set(
					leaves
						.map((leaf) => labelFromProperties(leaf.properties as Record<string, unknown>))
						.filter((label): label is string => label !== null)
				)
			];
			const pointCount = readCount(properties, 'point_count');
			const title =
				labels.length === 0
					? 'Grouped map area'
					: pointCount <= 1
						? labels[0]
						: `${labels[0]} + ${pointCount - 1} more`;
			showHoverPopup(
				event,
				title,
				`${readCount(properties, 'placementCount').toLocaleString()} mapped placements`
			);
		} catch {
			if (requestVersion !== hoverRequestVersion) return;
			showHoverPopup(
				event,
				'Grouped map area',
				`${coffeeCountLabel(readCount(properties, 'uniqueCoffeeCount'))} · zoom in for regions`
			);
		}
	}

	function featureCoordinates(event: MapLayerMouseEvent): [number, number] | null {
		const geometry = event.features?.[0]?.geometry;
		if (geometry?.type !== 'Point' || !Array.isArray(geometry.coordinates)) return null;
		const [longitude, latitude] = geometry.coordinates;
		return typeof longitude === 'number' && typeof latitude === 'number'
			? [longitude, latitude]
			: null;
	}

	function currentViewport(
		currentMap: MapLibreMap
	): Omit<CatalogMapViewportChange, 'commitSearch'> {
		const currentCenter = currentMap.getCenter();
		const currentBounds = currentMap.getBounds();
		return {
			center: [normalizeCatalogMapLongitude(currentCenter.lng), currentCenter.lat],
			zoom: currentMap.getZoom(),
			bounds: normalizeCatalogMapBounds({
				west: currentBounds.getWest(),
				south: currentBounds.getSouth(),
				east: currentBounds.getEast(),
				north: currentBounds.getNorth()
			})
		};
	}

	async function handleVisualClusterClick(event: MapLayerMouseEvent) {
		const currentMap = map;
		const properties = readProperties(event);
		const clusterId = Number(properties?.cluster_id);
		if (!currentMap || !properties || !Number.isFinite(clusterId)) return;

		const source = currentMap.getSource('catalog-map') as GeoJSONSource | undefined;
		const coordinates = featureCoordinates(event);
		if (!source || !coordinates) return;
		const leafLimit = readCount(properties, 'point_count');
		const expansionZoomPromise = source.getClusterExpansionZoom(clusterId);
		try {
			const leaves = await source.getClusterLeaves(clusterId, leafLimit, 0);
			const leafProperties = leaves
				.map((leaf) => leaf.properties as Record<string, unknown> | null)
				.filter((leaf): leaf is Record<string, unknown> => leaf !== null);
			const catalogIds = [...new Set(leafProperties.flatMap(catalogIdsFromProperties))].sort(
				(left, right) => left - right
			);
			const originLabels = [
				...new Set(
					leafProperties.map(labelFromProperties).filter((label): label is string => label !== null)
				)
			];
			onClusterSelect({
				kind: 'area',
				label: 'Selected map area',
				precisionLabel: 'Nearby mapped origins',
				mappedOriginCount: readCount(properties, 'placementCount'),
				coffeeMatchCount:
					catalogIds.length > 0 ? catalogIds.length : readCount(properties, 'uniqueCoffeeCount'),
				catalogIds,
				originLabels
			});
		} catch {
			onClusterSelect({
				kind: 'area',
				label: 'Selected map area',
				precisionLabel: 'Nearby mapped origins',
				mappedOriginCount: readCount(properties, 'placementCount'),
				coffeeMatchCount: readCount(properties, 'uniqueCoffeeCount'),
				catalogIds: [],
				originLabels: []
			});
		}
		let expansionZoom: number;
		try {
			expansionZoom = await expansionZoomPromise;
		} catch {
			return;
		}
		if (destroyed || map !== currentMap) return;
		currentMap.easeTo({ center: coordinates, zoom: Math.min(expansionZoom, 16), duration: 350 });
	}

	function handleSharedLocationClick(event: MapLayerMouseEvent) {
		const properties = readPointProperties(event);
		if (!properties || (properties.type !== 'cluster' && properties.type !== 'location')) return;
		const catalogIds = catalogIdsFromProperties(properties as unknown as Record<string, unknown>);
		if (catalogIds.length === 1 && properties.uniqueCoffeeCount === 1) {
			onPlaceSelect(catalogIds[0], properties.placeId);
			return;
		}
		onClusterSelect({
			kind: 'location',
			label: properties.label,
			precisionLabel:
				properties.precisionLabel === 'Cluster' ? 'Broad mapped area' : properties.precisionLabel,
			mappedOriginCount: properties.placementCount,
			coffeeMatchCount: catalogIds.length || properties.uniqueCoffeeCount,
			catalogIds,
			originLabels: properties.label === 'Mapped area' ? [] : [properties.label]
		});
	}

	function handlePlaceClick(event: MapLayerMouseEvent) {
		const properties = readPointProperties(event);
		if (!properties || properties.type !== 'place' || properties.catalogId === null) return;
		onPlaceSelect(properties.catalogId, properties.placeId);
	}

	function scheduleResize() {
		if (resizeFrame !== null) cancelAnimationFrame(resizeFrame);
		resizeFrame = requestAnimationFrame(() => {
			resizeFrame = null;
			map?.resize();
		});
	}

	onMount(() => {
		void (async () => {
			try {
				const { Map, NavigationControl, Popup, setWorkerUrl } = await import('maplibre-gl');
				if (destroyed) return;
				setWorkerUrl(maplibreWorkerUrl);
				map = new Map({
					container,
					style: styleUrl,
					center,
					zoom,
					minZoom: 1,
					maxZoom: 16,
					cooperativeGestures: false
				});
				hoverPopup = new Popup({
					closeButton: false,
					closeOnClick: false,
					offset: 18,
					className: 'catalog-map-hover-popup'
				});
				map.addControl(new NavigationControl({ showCompass: false }), 'top-right');
				if (typeof ResizeObserver !== 'undefined') {
					resizeObserver = new ResizeObserver(scheduleResize);
					resizeObserver.observe(container);
				}

				map.on('load', () => {
					if (!map) return;
					applyPurveyorsBasemapTheme(map);
					map.addSource('catalog-map', {
						type: 'geojson',
						data: toCatalogMapGeoJson(items),
						cluster: true,
						clusterMaxZoom: 14,
						clusterRadius: 52,
						clusterProperties: {
							placementCount: ['+', ['get', 'placementCount']],
							uniqueCoffeeCount: ['+', ['get', 'uniqueCoffeeCount']]
						}
					});
					map.addLayer({
						id: 'catalog-map-clusters',
						type: 'circle',
						source: 'catalog-map',
						filter: ['has', 'point_count'],
						paint: {
							'circle-color': '#302F2A',
							'circle-radius': [
								'interpolate',
								['linear'],
								['get', 'placementCount'],
								1,
								17,
								25,
								23,
								100,
								31
							],
							'circle-stroke-color': '#FCFAF8',
							'circle-stroke-width': 2,
							'circle-opacity': 0.92
						}
					});
					map.addLayer({
						id: 'catalog-map-cluster-labels',
						type: 'symbol',
						source: 'catalog-map',
						filter: ['has', 'point_count'],
						layout: {
							'text-field': ['to-string', ['get', 'placementCount']],
							'text-size': 12,
							'text-font': ['Noto Sans Regular']
						},
						paint: { 'text-color': '#FCFAF8' }
					});
					map.addLayer({
						id: 'catalog-map-shared-locations',
						type: 'circle',
						source: 'catalog-map',
						filter: [
							'all',
							['!', ['has', 'point_count']],
							['any', ['==', ['get', 'type'], 'cluster'], ['==', ['get', 'type'], 'location']]
						],
						paint: {
							'circle-color': ['get', 'color'],
							'circle-radius': 14,
							'circle-stroke-color': '#FCFAF8',
							'circle-stroke-width': 2
						}
					});
					map.addLayer({
						id: 'catalog-map-shared-location-labels',
						type: 'symbol',
						source: 'catalog-map',
						filter: [
							'all',
							['!', ['has', 'point_count']],
							['any', ['==', ['get', 'type'], 'cluster'], ['==', ['get', 'type'], 'location']]
						],
						layout: {
							'text-field': ['to-string', ['get', 'placementCount']],
							'text-size': 11,
							'text-font': ['Noto Sans Regular']
						},
						paint: { 'text-color': '#FCFAF8' }
					});
					map.addLayer({
						id: 'catalog-map-shared-location-hit-targets',
						type: 'circle',
						source: 'catalog-map',
						filter: [
							'all',
							['!', ['has', 'point_count']],
							['any', ['==', ['get', 'type'], 'cluster'], ['==', ['get', 'type'], 'location']]
						],
						paint: {
							'circle-color': '#302F2A',
							'circle-radius': 22,
							'circle-opacity': 0.01
						}
					});
					map.addLayer({
						id: 'catalog-map-places',
						type: 'circle',
						source: 'catalog-map',
						filter: ['all', ['!', ['has', 'point_count']], ['==', ['get', 'type'], 'place']],
						paint: {
							'circle-color': ['get', 'color'],
							'circle-radius': 8,
							'circle-stroke-color': '#FCFAF8',
							'circle-stroke-width': 2
						}
					});
					map.addLayer({
						id: 'catalog-map-place-hit-targets',
						type: 'circle',
						source: 'catalog-map',
						filter: ['all', ['!', ['has', 'point_count']], ['==', ['get', 'type'], 'place']],
						paint: {
							'circle-color': '#302F2A',
							'circle-radius': 22,
							'circle-opacity': 0.01
						}
					});
					map.addLayer({
						id: 'catalog-map-place-labels',
						type: 'symbol',
						source: 'catalog-map',
						filter: ['all', ['!', ['has', 'point_count']], ['==', ['get', 'type'], 'place']],
						minzoom: 4,
						layout: {
							'text-field': ['get', 'label'],
							'text-size': 11,
							'text-offset': [0, 1.2],
							'text-anchor': 'top'
						},
						paint: {
							'text-color': '#302F2A',
							'text-halo-color': '#FCFAF8',
							'text-halo-width': 1.5
						}
					});

					map.on('click', 'catalog-map-clusters', (event) => {
						void handleVisualClusterClick(event);
					});
					map.on('click', 'catalog-map-shared-location-hit-targets', handleSharedLocationClick);
					map.on('click', 'catalog-map-place-hit-targets', handlePlaceClick);
					map.on('mouseenter', 'catalog-map-clusters', (event) => {
						if (map) map.getCanvas().style.cursor = 'pointer';
						void handleVisualClusterHover(event);
					});
					for (const layer of [
						'catalog-map-shared-location-hit-targets',
						'catalog-map-place-hit-targets'
					]) {
						map.on('mouseenter', layer, (event) => {
							if (map) map.getCanvas().style.cursor = 'pointer';
							handlePointHover(event);
						});
					}
					for (const layer of [
						'catalog-map-clusters',
						'catalog-map-shared-location-hit-targets',
						'catalog-map-place-hit-targets'
					]) {
						map.on('mouseleave', layer, () => {
							if (map) map.getCanvas().style.cursor = '';
							hideHoverPopup();
						});
					}
					sourceReady = true;
					addTerrainReliefLayer(map);
					scheduleResize();
					onMapReady();
				});

				map.on('moveend', () => {
					if (!map) return;
					onViewportChange({ ...currentViewport(map), commitSearch: false });
				});
				map.on('error', (event) => {
					if (!sourceReady) {
						onMapError(event.error?.message ?? 'The basemap could not be loaded.');
					}
				});
			} catch (error) {
				onMapError(error instanceof Error ? error.message : 'The map renderer could not start.');
			}
		})();

		return () => {
			destroyed = true;
			resizeObserver?.disconnect();
			resizeObserver = null;
			if (resizeFrame !== null) cancelAnimationFrame(resizeFrame);
			hoverPopup?.remove();
			hoverPopup = null;
			map?.remove();
			map = null;
		};
	});

	$effect(() => {
		if (!sourceReady || !map) return;
		const source = map.getSource('catalog-map') as GeoJSONSource | undefined;
		source?.setData(toCatalogMapGeoJson(items));
	});

	$effect(() => {
		if (!sourceReady || !map) return;
		const currentCenter = map.getCenter();
		const currentZoom = map.getZoom();
		if (
			Math.abs(currentCenter.lng - center[0]) > 0.0001 ||
			Math.abs(currentCenter.lat - center[1]) > 0.0001 ||
			Math.abs(currentZoom - zoom) > 0.01
		) {
			map.jumpTo({ center, zoom });
		}
	});
</script>

<div
	bind:this={container}
	class="catalog-map-canvas h-full min-h-0 w-full bg-surface-panel"
	aria-label="Interactive catalog origin map. Use the adjacent feature list for an accessible alternative."
></div>

<style>
	:global(.catalog-map-canvas .maplibregl-ctrl-group) {
		overflow: hidden;
		border: 1px solid #e4e4e2;
		border-radius: 0.375rem;
		background: #fcfaf8;
		box-shadow: 0 1px 3px rgb(48 47 42 / 0.14);
	}

	:global(.catalog-map-canvas .maplibregl-ctrl-group button) {
		width: 2.75rem;
		height: 2.75rem;
	}

	:global(.catalog-map-canvas .maplibregl-ctrl-group button + button) {
		border-top-color: #e4e4e2;
	}

	:global(.catalog-map-canvas .maplibregl-ctrl-group button:not(:disabled):hover) {
		background-color: rgb(249 165 123 / 0.2);
	}

	:global(.catalog-map-canvas .maplibregl-ctrl-group button:focus-visible) {
		outline: 2px solid #f9a57b;
		outline-offset: -2px;
	}

	:global(.catalog-map-canvas .maplibregl-ctrl-attrib) {
		background: rgb(252 250 248 / 0.9);
		color: #695c4d;
	}

	:global(.catalog-map-hover-popup .maplibregl-popup-content) {
		padding: 0.55rem 0.7rem;
		border: 1px solid #e4e4e2;
		border-radius: 0.375rem;
		background: rgb(252 250 248 / 0.97);
		box-shadow: 0 4px 12px rgb(48 47 42 / 0.18);
	}

	:global(.catalog-map-hover-popup .maplibregl-popup-tip) {
		border-top-color: rgb(252 250 248 / 0.97);
	}

	:global(.catalog-map-hover-content) {
		display: grid;
		gap: 0.15rem;
		max-width: 15rem;
		font-size: 0.75rem;
		line-height: 1.25;
		color: #302f2a;
	}

	:global(.catalog-map-hover-content span) {
		font-size: 0.68rem;
		color: #695c4d;
	}

	@media (min-width: 640px) {
		:global(.catalog-map-canvas .maplibregl-ctrl-group button) {
			width: 2.25rem;
			height: 2.25rem;
		}
	}
</style>
