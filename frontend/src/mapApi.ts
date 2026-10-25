import { useEffect, useState } from 'react';
import { SERVICE_CATEGORIES } from './components/ui';
import type { CatalogItem, MapBounds, MapRecommendations } from './types';

// The map opens on Chulalongkorn University.
export const CHULA = { lat: 13.7384, lng: 100.532 };
export const DEFAULT_ZOOM = 15;
// The API refuses areas wider than 2 degrees; zoom 11 stays well inside that.
export const MIN_ZOOM = 11;
export const MAX_ZOOM = 19;
// Wait this long after the map stops moving, or typing stops, before fetching.
export const DEBOUNCE_MS = 400;

export type Viewport = {
    bounds: MapBounds;
    zoom: number;
    center: { lat: number; lng: number };
};

export type MapFilters = {
    q: string;
    category: string;
    maxPrice: string;
    minRating: string;
    includeUnmatched: boolean;
};

export const RATING_OPTIONS = [
    { value: '', label: 'Any rating' },
    { value: '3', label: '3+ stars' },
    { value: '4', label: '4+ stars' },
    { value: '4.5', label: '4.5+ stars' },
];

// Filters and the map position live in the URL, so a view can be shared and
// survives a refresh.
export function readFilters(params: URLSearchParams): MapFilters {
    return {
        q: params.get('q') ?? '',
        category: params.get('cat') ?? '',
        maxPrice: params.get('price') ?? '',
        minRating: params.get('rating') ?? '',
        includeUnmatched: params.get('others') !== '0',
    };
}

export function filterParams(
    filters: Partial<MapFilters>,
): Record<string, string | null> {
    const params: Record<string, string | null> = {};
    if (filters.q !== undefined) params.q = filters.q.trim() || null;
    if (filters.category !== undefined) params.cat = filters.category || null;
    if (filters.maxPrice !== undefined) params.price = filters.maxPrice || null;
    if (filters.minRating !== undefined)
        params.rating = filters.minRating || null;
    if (filters.includeUnmatched !== undefined)
        params.others = filters.includeUnmatched ? null : '0';
    return params;
}

export function readPosition(params: URLSearchParams): {
    center: { lat: number; lng: number };
    zoom: number;
} {
    const lat = Number(params.get('lat'));
    const lng = Number(params.get('lng'));
    const zoom = Number(params.get('z'));
    const valid =
        params.has('lat') &&
        params.has('lng') &&
        Number.isFinite(lat) &&
        Number.isFinite(lng) &&
        Math.abs(lat) <= 85 &&
        Math.abs(lng) <= 180;
    return {
        center: valid ? { lat, lng } : CHULA,
        zoom:
            Number.isInteger(zoom) && zoom >= MIN_ZOOM && zoom <= MAX_ZOOM
                ? zoom
                : DEFAULT_ZOOM,
    };
}

// A small pan (under a tenth of the view on every edge) at the same zoom
// does not change what is worth showing, so it does not fetch again.
export function barelyChanged(a: Viewport, b: Viewport): boolean {
    if (a.zoom !== b.zoom) return false;
    const latTolerance = (a.bounds.maxLat - a.bounds.minLat) * 0.1;
    const lngTolerance = (a.bounds.maxLng - a.bounds.minLng) * 0.1;
    return (
        Math.abs(a.bounds.minLat - b.bounds.minLat) < latTolerance &&
        Math.abs(a.bounds.maxLat - b.bounds.maxLat) < latTolerance &&
        Math.abs(a.bounds.minLng - b.bounds.minLng) < lngTolerance &&
        Math.abs(a.bounds.maxLng - b.bounds.maxLng) < lngTolerance
    );
}

// Bounds are rounded outwards to 3 decimals (about 100 m) so nearby views
// share a cache entry without leaving out anything visible.
export function mapRequestUrl(
    petId: number,
    viewport: Viewport,
    filters: MapFilters,
): string {
    const down = (value: number) => (Math.floor(value * 1000) / 1000).toFixed(3);
    const up = (value: number) => (Math.ceil(value * 1000) / 1000).toFixed(3);
    const params = new URLSearchParams({
        minLat: down(viewport.bounds.minLat),
        minLng: down(viewport.bounds.minLng),
        maxLat: up(viewport.bounds.maxLat),
        maxLng: up(viewport.bounds.maxLng),
        zoom: String(Math.round(viewport.zoom)),
    });
    if (filters.q.trim()) params.set('q', filters.q.trim());
    if (filters.category) params.set('category', filters.category);
    if (Number(filters.maxPrice) > 0) params.set('maxPrice', filters.maxPrice);
    if (filters.minRating) params.set('minRating', filters.minRating);
    if (filters.includeUnmatched) params.set('includeUnmatched', 'true');
    return `/api/recommendation/pets/${petId}/map?${params}`;
}

// Responses for this session, by request URL.
const cache = new Map<string, MapRecommendations>();
const CACHE_SIZE = 60;

async function fetchMap(
    url: string,
    signal: AbortSignal,
): Promise<MapRecommendations> {
    const hit = cache.get(url);
    if (hit) return hit;
    const response = await fetch(url, { signal });
    if (!response.ok) {
        throw new Error(
            response.status === 400
                ? 'This area is too large to search. Zoom in and try again.'
                : 'Recommendations are temporarily unavailable.',
        );
    }
    const data = (await response.json()) as MapRecommendations;
    cache.set(url, data);
    if (cache.size > CACHE_SIZE) {
        const oldest = cache.keys().next().value;
        if (oldest !== undefined) cache.delete(oldest);
    }
    return data;
}

// The catalog, fetched once per session.
let catalogRequest: Promise<CatalogItem[]> | null = null;

function loadCatalog(): Promise<CatalogItem[]> {
    catalogRequest ??= fetch('/api/catalog')
        .then((response) => {
            if (!response.ok) throw new Error('Could not load the catalog.');
            return response.json() as Promise<CatalogItem[]>;
        })
        .catch((error: unknown) => {
            catalogRequest = null;
            throw error;
        });
    return catalogRequest;
}

// The categories that have a service for this species, so a cat owner is
// not offered dog walking. Null until the catalog loads; every category if
// it can't.
export function useCategoriesFor(species: string): string[] | null {
    const [offered, setOffered] = useState<Set<string> | null>(null);
    useEffect(() => {
        let active = true;
        const wanted = species.toLowerCase();
        loadCatalog()
            .then((catalog) => {
                if (!active) return;
                setOffered(
                    new Set(
                        catalog
                            .filter((service) =>
                                service.species.some((value) => value.toLowerCase() === wanted),
                            )
                            .map((service) => service.category),
                    ),
                );
            })
            .catch(() => {
                if (active) setOffered(new Set(SERVICE_CATEGORIES));
            });
        return () => {
            active = false;
        };
    }, [species]);
    return offered && SERVICE_CATEGORIES.filter((category) => offered.has(category));
}

// How far past the outermost services the map may go, about 1 km.
const AREA_MARGIN_DEGREES = 0.01;

// The area the map is held to: every service and Chula, plus a margin.
// Null until the catalog loads, or if it can't, and then the map is free.
export function useServiceArea(): MapBounds | null {
    const [area, setArea] = useState<MapBounds | null>(null);
    useEffect(() => {
        let active = true;
        loadCatalog()
            .then((catalog) => {
                if (!active) return;
                const points = [
                    CHULA,
                    ...catalog.flatMap((service) => service.location ?? []),
                ];
                const lats = points.map((point) => point.lat);
                const lngs = points.map((point) => point.lng);
                setArea({
                    minLat: Math.min(...lats) - AREA_MARGIN_DEGREES,
                    minLng: Math.min(...lngs) - AREA_MARGIN_DEGREES,
                    maxLat: Math.max(...lats) + AREA_MARGIN_DEGREES,
                    maxLng: Math.max(...lngs) + AREA_MARGIN_DEGREES,
                });
            })
            .catch(() => undefined);
        return () => {
            active = false;
        };
    }, []);
    return area;
}

// Fetches recommendations for the visible area. While a new area loads, the
// previous results for the same pet stay on screen.
export function useMapRecommendations(
    petId: number,
    viewport: Viewport | null,
    filters: MapFilters,
) {
    const url = viewport ? mapRequestUrl(petId, viewport, filters) : null;
    const [loaded, setLoaded] = useState<{
        url: string;
        petId: number;
        data: MapRecommendations;
    } | null>(null);
    const [failed, setFailed] = useState<{
        url: string;
        attempt: number;
        message: string;
    } | null>(null);
    const [attempt, setAttempt] = useState(0);

    useEffect(() => {
        if (!url) return;
        const controller = new AbortController();
        fetchMap(url, controller.signal)
            .then((data) => setLoaded({ url, petId, data }))
            .catch((error: unknown) => {
                if (controller.signal.aborted) return;
                setFailed({
                    url,
                    attempt,
                    message:
                        error instanceof Error
                            ? error.message
                            : 'Could not load recommendations.',
                });
            });
        return () => controller.abort();
    }, [url, petId, attempt]);

    const exact = url ? cache.get(url) : undefined;
    const error =
        failed && failed.url === url && failed.attempt === attempt
            ? failed.message
            : '';
    return {
        data: exact ?? (loaded?.petId === petId ? loaded.data : null),
        loading: url !== null && !exact && !error,
        error,
        retry: () => setAttempt((value) => value + 1),
    };
}
