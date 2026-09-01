<script lang="ts">
	import { onMount } from 'svelte';
	import 'maplibre-gl/dist/maplibre-gl.css';
	import maplibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
	import type { GeoJSONSource, Map as MapLibreMap, MapLayerMouseEvent } from 'maplibre-gl';
	import {
		toCatalogMapGeoJson,
		type CatalogMapItem,
		type CatalogMapPointProperties
	} from '$lib/catalog/mapPresentation';
	import {
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

	interface Props {
		items: CatalogMapItem[];
		lens: CatalogMapLens;
		center: [number, number];
		zoom: number;
		styleUrl?: string;
		canSearchViewport?: boolean;
		onViewportChange: (viewport: CatalogMapViewportChange) => void;
		onPlaceSelect: (catalogId: number, placeId: string | null) => void;
		onMapReady?: () => void;
		onMapError?: (message: string) => void;
	}

	let {
		items,
		lens,
		center,
		zoom,
		styleUrl = 'https://tiles.openfreemap.org/styles/positron',
		canSearchViewport = true,
		onViewportChange,
		onPlaceSelect,
		onMapReady = () => {},
		onMapError = () => {}
	}: Props = $props();

	let container: HTMLDivElement;
	let map: MapLibreMap | null = null;
	let sourceReady = $state(false);
	let commitNextMove = false;
	let destroyed = false;

	function readPointProperties(event: MapLayerMouseEvent): CatalogMapPointProperties | null {
		const properties = event.features?.[0]?.properties;
		if (!properties || typeof properties.type !== 'string') return null;
		return properties as CatalogMapPointProperties;
	}

	function currentViewport(
		currentMap: MapLibreMap
	): Omit<CatalogMapViewportChange, 'commitSearch'> {
		const currentCenter = currentMap.getCenter();
		const currentBounds = currentMap.getBounds();
		return {
			center: [currentCenter.lng, currentCenter.lat],
			zoom: currentMap.getZoom(),
			bounds: normalizeCatalogMapBounds({
				west: currentBounds.getWest(),
				south: currentBounds.getSouth(),
				east: currentBounds.getEast(),
				north: currentBounds.getNorth()
			})
		};
	}

	function handleClusterClick(event: MapLayerMouseEvent) {
		if (!map) return;
		const properties = readPointProperties(event);
		if (!properties || properties.type !== 'cluster') return;
		if (
			properties.west === null ||
			properties.south === null ||
			properties.east === null ||
			properties.north === null
		) {
			return;
		}

		// MapLibre accepts longitudes beyond 180 when fitting an antimeridian box.
		// Preserve Parchment's west>east meaning by unwrapping the east edge.
		const east = properties.west > properties.east ? properties.east + 360 : properties.east;
		commitNextMove = canSearchViewport;
		map.fitBounds(
			[
				[properties.west, properties.south],
				[east, properties.north]
			],
			{ padding: 56, maxZoom: 11, duration: 500 }
		);
	}

	function handlePlaceClick(event: MapLayerMouseEvent) {
		const properties = readPointProperties(event);
		if (!properties || properties.type !== 'place' || properties.catalogId === null) return;
		onPlaceSelect(properties.catalogId, properties.placeId);
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
					cooperativeGestures: true
				});
				map.addControl(new NavigationControl({ showCompass: false }), 'top-right');

				map.on('load', () => {
					if (!map) return;
					map.addSource('catalog-map', {
						type: 'geojson',
						data: toCatalogMapGeoJson(items, lens)
					});
					map.addLayer({
						id: 'catalog-map-clusters',
						type: 'circle',
						source: 'catalog-map',
						filter: ['==', ['get', 'type'], 'cluster'],
						paint: {
							'circle-color': ['get', 'color'],
							'circle-radius': [
								'interpolate',
								['linear'],
								['get', 'placementCount'],
								1,
								18,
								25,
								28,
								100,
								38
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
						filter: ['==', ['get', 'type'], 'cluster'],
						layout: {
							'text-field': ['to-string', ['get', 'placementCount']],
							'text-size': 12,
							'text-font': ['Noto Sans Regular']
						},
						paint: { 'text-color': '#FCFAF8' }
					});
					map.addLayer({
						id: 'catalog-map-places',
						type: 'circle',
						source: 'catalog-map',
						filter: ['==', ['get', 'type'], 'place'],
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
						filter: ['==', ['get', 'type'], 'place'],
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

					map.on('click', 'catalog-map-clusters', handleClusterClick);
					map.on('click', 'catalog-map-places', handlePlaceClick);
					for (const layer of ['catalog-map-clusters', 'catalog-map-places']) {
						map.on('mouseenter', layer, () => {
							if (map) map.getCanvas().style.cursor = 'pointer';
						});
						map.on('mouseleave', layer, () => {
							if (map) map.getCanvas().style.cursor = '';
						});
					}
					sourceReady = true;
					onMapReady();
				});

				map.on('moveend', () => {
					if (!map) return;
					onViewportChange({ ...currentViewport(map), commitSearch: commitNextMove });
					commitNextMove = false;
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
	class="h-full min-h-[28rem] w-full bg-surface-panel"
	aria-label="Interactive catalog origin map. Use the adjacent feature list for an accessible alternative."
></div>
