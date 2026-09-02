<script lang="ts">
	import { onMount } from 'svelte';
	import 'maplibre-gl/dist/maplibre-gl.css';
	import maplibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
	import type { GeoJSONSource, Map as MapLibreMap, MapLayerMouseEvent } from 'maplibre-gl';
	import {
		toCatalogMapGeoJson,
		type CatalogMapDisplayItem,
		type CatalogMapPointProperties
	} from '$lib/catalog/mapPresentation';
	import {
		normalizeCatalogMapLongitude,
		normalizeCatalogMapBounds,
		type CatalogMapBounds,
		type CatalogMapLens
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
		lens: CatalogMapLens;
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
		lens,
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
	let sourceReady = $state(false);
	let destroyed = false;
	let resizeObserver: ResizeObserver | null = null;
	let resizeFrame: number | null = null;

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
				const { Map, NavigationControl, setWorkerUrl } = await import('maplibre-gl');
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
				map.addControl(new NavigationControl({ showCompass: false }), 'top-right');
				if (typeof ResizeObserver !== 'undefined') {
					resizeObserver = new ResizeObserver(scheduleResize);
					resizeObserver.observe(container);
				}

				map.on('load', () => {
					if (!map) return;
					map.addSource('catalog-map', {
						type: 'geojson',
						data: toCatalogMapGeoJson(items, lens),
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
					map.on('click', 'catalog-map-shared-locations', handleSharedLocationClick);
					map.on('click', 'catalog-map-places', handlePlaceClick);
					for (const layer of [
						'catalog-map-clusters',
						'catalog-map-shared-locations',
						'catalog-map-places'
					]) {
						map.on('mouseenter', layer, () => {
							if (map) map.getCanvas().style.cursor = 'pointer';
						});
						map.on('mouseleave', layer, () => {
							if (map) map.getCanvas().style.cursor = '';
						});
					}
					sourceReady = true;
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
			map?.remove();
			map = null;
		};
	});

	$effect(() => {
		if (!sourceReady || !map) return;
		const source = map.getSource('catalog-map') as GeoJSONSource | undefined;
		source?.setData(toCatalogMapGeoJson(items, lens));
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
	class="h-full min-h-0 w-full bg-surface-panel"
	aria-label="Interactive catalog origin map. Use the adjacent feature list for an accessible alternative."
></div>
