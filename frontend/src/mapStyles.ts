import type { StyleSpecification } from 'maplibre-gl';

export const MAP_STYLES = ['calm', 'streets', 'night'] as const;
export type MapStyle = (typeof MAP_STYLES)[number];
type StyleLayer = StyleSpecification['layers'][number];

// OpenFreeMap supports custom styles; retain its sources and bilingual labels.
// https://openfreemap.org/quick_start/#custom-styles
const STYLE_BASE_URL = 'https://tiles.openfreemap.org/styles/';
const CALM_HIDDEN_SOURCES = new Set(['poi', 'building', 'aerodrome_label']);
const GREEN_LAND = /wood|grass|wetland|park|pitch|track|cemetery/;

function keepLayer(layer: StyleLayer, style: MapStyle): boolean {
    if (layer.type === 'fill-extrusion') return false;
    if (layer.id.includes('shield')) return false;
    if (style === 'streets') return true;

    const sourceLayer = 'source-layer' in layer ? layer['source-layer'] : undefined;
    if (/hatching|one_way_arrow/.test(layer.id)) return false;
    if (sourceLayer && CALM_HIDDEN_SOURCES.has(sourceLayer)) return false;
    if (layer.id === 'road_area_pattern' || layer.id === 'highway-name-path') return false;
    return true;
}

function calmLayer(layer: StyleLayer, night = false): StyleLayer {
    const sourceLayer = 'source-layer' in layer ? layer['source-layer'] : undefined;

    if (layer.type === 'background') {
        return { ...layer, paint: { ...layer.paint, 'background-color': night ? '#192b32' : '#f6f4ed' } };
    }

    if (layer.type === 'fill') {
        const paint = { ...layer.paint };
        // Texture and sharp outlines add clutter at the neighborhood scale.
        delete paint['fill-pattern'];
        delete paint['fill-outline-color'];
        if (sourceLayer === 'water') {
            paint['fill-color'] = night ? '#214b60' : '#acd9e7';
        } else if (sourceLayer === 'park' || GREEN_LAND.test(layer.id)) {
            paint['fill-color'] = night ? '#294f45' : '#cde4ce';
            paint['fill-opacity'] = sourceLayer === 'park' ? 0.9 : 0.7;
        } else if (sourceLayer === 'landuse') {
            paint['fill-color'] = night ? '#20343a' : '#eeece1';
        } else if (sourceLayer === 'transportation') {
            paint['fill-color'] = night ? '#40565e' : '#ffffff';
        }
        return { ...layer, paint };
    }

    if (layer.type === 'line') {
        const paint = { ...layer.paint };
        if (sourceLayer === 'waterway') {
            paint['line-color'] = night ? '#214b60' : '#acd9e7';
        } else if (sourceLayer === 'park') {
            paint['line-color'] = night ? '#294f45' : '#bed7bf';
            paint['line-opacity'] = 0.5;
        } else if (sourceLayer === 'transportation') {
            if (layer.id.includes('rail')) {
                paint['line-color'] = night ? '#49616a' : '#bec8c0';
                paint['line-opacity'] = 0.55;
            } else if (layer.id.includes('casing')) {
                paint['line-color'] = night ? '#2c4148' : '#ded9cc';
                paint['line-opacity'] = 0.65;
            } else {
                paint['line-color'] = /motorway|trunk_primary/.test(layer.id)
                    ? night ? '#8f805f' : '#f0d79c'
                    : night ? '#40565e' : '#ffffff';
            }
        }
        return { ...layer, paint };
    }

    if (layer.type === 'symbol') {
        const majorRoad = layer.id === 'highway-name-major';
        const minorRoad = layer.id === 'highway-name-minor';
        return {
            ...layer,
            minzoom: minorRoad ? 16 : majorRoad ? 13 : layer.minzoom,
            layout: {
                ...layer.layout,
                'text-padding': majorRoad ? 8 : 12,
                ...(majorRoad || minorRoad ? { 'symbol-spacing': 450 } : {}),
            },
            paint: {
                ...layer.paint,
                'text-color': sourceLayer === 'water_name'
                    ? night ? '#8cb8c9' : '#457487'
                    : night ? '#c2d4d6' : '#52625d',
                'text-halo-color': night ? '#192b32' : '#f6f4ed',
                'text-halo-width': 1.5,
            },
        };
    }

    return layer;
}

export async function loadMapStyle(
    style: MapStyle,
    signal: AbortSignal,
): Promise<StyleSpecification> {
    const response = await fetch(`${STYLE_BASE_URL}liberty`, {
        signal,
    });
    if (!response.ok) throw new Error('Could not load the map style.');

    const source = await response.json() as StyleSpecification;
    const layers = source.layers.filter((layer) => keepLayer(layer, style));
    return {
        ...source,
        layers: style === 'streets' ? layers : layers.map((layer) => calmLayer(layer, style === 'night')),
    };
}
