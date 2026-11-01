import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type L from 'leaflet';
import type { MapRecommendation, MapRecommendations, Pet } from '../types';
import {
    DEBOUNCE_MS,
    filterParams,
    MIN_ZOOM,
    readFilters,
    readPosition,
    useMapRecommendations,
    useServiceArea,
    type MapFilters as Filters,
    type Viewport,
} from '../mapApi';
import { DESKTOP_QUERY, useMediaQuery } from '../useMediaQuery';
import { MapFilters } from './MapFilters';
import { RecommendationMap } from './RecommendationMap';
import { ResultsPanel } from './ResultsPanel';
import { mapFrameHeightClass } from './ui';

const FRAME_MAX_HEIGHT = 800;

interface MapExplorerProps {
    pet: Pet;
    params: URLSearchParams;
    updateParams: (patch: Record<string, string | null>) => void;
    onShowReviews: (item: MapRecommendation) => void;
    onWriteReview: (item: MapRecommendation) => void;
}

// Search, results, and map in one frame. Wide screens put the filters and
// results in a column to the right of the map; phones put the filters
// above it and the results in a sheet over its bottom edge.
export function MapExplorer({
    pet,
    params,
    updateParams,
    onShowReviews,
    onWriteReview,
}: MapExplorerProps) {
    const isDesktop = useMediaQuery(DESKTOP_QUERY);
    const filters = readFilters(params);
    // The map keeps its own position after it opens; the URL follows it.
    const [initial] = useState(() => readPosition(params));
    const [viewport, setViewport] = useState<Viewport | null>(null);
    const [qInput, setQInput] = useState(filters.q);
    const [priceInput, setPriceInput] = useState(filters.maxPrice);
    const [hoveredId, setHoveredId] = useState<number | null>(null);
    const [selected, setSelected] = useState<MapRecommendation | null>(null);
    const [map, setMap] = useState<L.Map | null>(null);
    const frameRef = useRef<HTMLDivElement>(null);
    const area = useServiceArea();

    // End the frame at the bottom of the window, wherever the header above
    // leaves it, so the whole search fits on one screen. On phones that also
    // leaves the header to scroll by, since a drag on the map pans it. `svh`
    // keeps it steady as mobile browser bars come and go. Tall screens stop
    // at FRAME_MAX_HEIGHT, past which the results list just gets longer.
    useLayoutEffect(() => {
        const frame = frameRef.current;
        if (!frame) return;
        const fit = () => {
            const top = frame.getBoundingClientRect().top + window.scrollY;
            const min = isDesktop ? 480 : 420;
            frame.style.height = `clamp(${min}px, calc(100svh - ${Math.round(top) + 16}px), ${FRAME_MAX_HEIGHT}px)`;
        };
        fit();
        window.addEventListener('resize', fit);
        return () => window.removeEventListener('resize', fit);
    }, [isDesktop]);

    const { data, loading, error, retry } = useMapRecommendations(
        pet.id,
        viewport,
        filters,
    );

    // Opening a service replaces the list, so the row under the pointer
    // never hears it leave; drop its highlight here.
    const select = (item: MapRecommendation) => {
        setHoveredId(null);
        setSelected(item);
    };

    // New filters mean a new set of results, so close any open service.
    const applyFilters = (patch: Partial<Filters>) => {
        setSelected(null);
        updateParams(filterParams(patch));
    };

    // Typing waits for a pause before it searches.
    useEffect(() => {
        if (qInput.trim() === filters.q) return;
        const timer = window.setTimeout(() => {
            setSelected(null);
            updateParams(filterParams({ q: qInput }));
        }, DEBOUNCE_MS);
        return () => window.clearTimeout(timer);
    }, [qInput, filters.q, updateParams]);

    useEffect(() => {
        const valid = priceInput === '' || Number(priceInput) > 0;
        if (!valid || priceInput === filters.maxPrice) return;
        const timer = window.setTimeout(() => {
            setSelected(null);
            updateParams(filterParams({ maxPrice: priceInput }));
        }, DEBOUNCE_MS);
        return () => window.clearTimeout(timer);
    }, [priceInput, filters.maxPrice, updateParams]);

    // Keep the open service's pin in the part of the map that isn't covered
    // by the controls or, on phones, the results sheet. If it is outside
    // that part, centre it there.
    useEffect(() => {
        if (!map || !selected) return;
        const size = map.getSize();
        const sheet = isDesktop
            ? 0
            : (document.getElementById('results-panel')?.offsetHeight ?? 0);
        const clear = isDesktop
            ? { top: 112, right: 72, bottom: 40, left: 32 }
            : { top: 64, right: 72, bottom: sheet + 40, left: 24 };
        const bottomEdge = Math.max(clear.top, size.y - clear.bottom);
        const point = map.latLngToContainerPoint([
            selected.service.location.lat,
            selected.service.location.lng,
        ]);
        const inView =
            point.x >= clear.left &&
            point.x <= size.x - clear.right &&
            point.y >= clear.top &&
            point.y <= bottomEdge;
        if (inView) return;
        map.panBy([
            point.x - (clear.left + size.x - clear.right) / 2,
            point.y - (clear.top + bottomEdge) / 2,
        ]);
    }, [map, selected, isDesktop]);

    function changeViewport(next: Viewport) {
        setViewport(next);
        updateParams({
            lat: next.center.lat.toFixed(5),
            lng: next.center.lng.toFixed(5),
            z: String(next.zoom),
        });
    }

    function clearFilters() {
        setQInput('');
        setPriceInput('');
        applyFilters({
            q: '',
            category: '',
            maxPrice: '',
            minRating: '',
            includeUnmatched: true,
        });
    }

    const recommendations = data?.recommendations ?? [];

    // "Show on map" opens here with ?service=<id>: once the first results
    // arrive, open that service. (Adjusting state while rendering, so the
    // details show in the same paint as the results.)
    const [focusId, setFocusId] = useState(() => Number(params.get('service')) || null);
    if (focusId !== null && data) {
        setFocusId(null);
        const match = data.recommendations.find((item) => item.service.id === focusId);
        if (match) setSelected(match);
    }
    // Then drop the parameter, so a refresh doesn't reopen it.
    const hasFocusParam = params.has('service');
    useEffect(() => {
        if (focusId === null && hasFocusParam) updateParams({ service: null });
    }, [focusId, hasFocusParam, updateParams]);

    const first = recommendations[0];
    const bestId =
        first && first.matched && pet.needs.length > 0 ? first.service.id : null;
    const hasFilters =
        Boolean(filters.q || filters.category || filters.maxPrice || filters.minRating) ||
        !filters.includeUnmatched;
    const extraPin =
        selected &&
        !recommendations.some((item) => item.service.id === selected.service.id)
            ? selected
            : null;

    return (
        <div
            ref={frameRef}
            className={`relative flex flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm lg:grid lg:grid-cols-[minmax(0,1fr)_24rem] lg:grid-rows-[auto_minmax(0,1fr)] xl:grid-cols-[minmax(0,1fr)_26rem] ${mapFrameHeightClass}`}
        >
            <MapFilters
                pet={pet}
                filters={filters}
                qInput={qInput}
                priceInput={priceInput}
                onQInput={setQInput}
                onPriceInput={setPriceInput}
                onChange={applyFilters}
                onClear={clearFilters}
            />

            {/* On wide screens this wrapper steps aside so the panel and map
                sit in the frame's grid; on phones it holds the map and the
                sheet over it. */}
            <div className="relative min-h-0 flex-1 lg:contents">
                <ResultsPanel
                    pet={pet}
                    data={data}
                    loading={loading}
                    error={error}
                    onRetry={retry}
                    hasFilters={hasFilters}
                    onClearFilters={clearFilters}
                    canZoomOut={(viewport?.zoom ?? MIN_ZOOM) > (map?.getMinZoom() ?? MIN_ZOOM)}
                    onZoomIn={() => map?.zoomIn()}
                    onZoomOut={() => map?.zoomOut()}
                    hoveredId={hoveredId}
                    onHover={setHoveredId}
                    selected={selected}
                    onSelect={select}
                    onBack={() => setSelected(null)}
                    onShowReviews={onShowReviews}
                    onWriteReview={onWriteReview}
                    isDesktop={isDesktop}
                />
                <div className="absolute inset-0 lg:static lg:col-start-1 lg:row-span-2 lg:row-start-1">
                    <RecommendationMap
                        initialCenter={initial.center}
                        initialZoom={initial.zoom}
                        area={area}
                        recommendations={recommendations}
                        extraPin={extraPin}
                        mode={data?.mode ?? null}
                        hoveredId={hoveredId}
                        selectedId={selected?.service.id ?? null}
                        bestId={bestId}
                        overlay={
                            <MapStatus
                                data={data}
                                loading={loading}
                                error={error}
                                onRetry={retry}
                                onZoomIn={() => map?.zoomIn()}
                            />
                        }
                        onReady={setMap}
                        onViewportChange={changeViewport}
                        onHover={setHoveredId}
                        onSelect={select}
                        onBackgroundClick={() => setSelected(null)}
                    />
                </div>
            </div>
        </div>
    );
}

// A note over the map, only while there is something to say about it.
function MapStatus({
    data,
    loading,
    error,
    onRetry,
    onZoomIn,
}: {
    data: MapRecommendations | null;
    loading: boolean;
    error: string;
    onRetry: () => void;
    onZoomIn: () => void;
}) {
    const chip =
        'inline-flex min-h-10 items-center gap-2 rounded-full bg-white/95 px-4 text-sm font-semibold shadow-md ring-1 ring-black/10';
    // The results panel announces errors; this is the same news on the map.
    if (error) {
        return (
            <span className={`${chip} text-red-800`}>
                <i aria-hidden="true" className="fa-solid fa-triangle-exclamation"></i>
                Couldn’t load this area
                <button
                    type="button"
                    onClick={onRetry}
                    className="min-h-10 rounded px-1 underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-700"
                >
                    Retry
                </button>
            </span>
        );
    }
    if (loading) {
        return (
            <span role="status" className={`${chip} text-gray-800`}>
                <i aria-hidden="true" className="fa-solid fa-spinner fa-spin text-teal-700"></i>
                Searching this area...
            </span>
        );
    }
    if (data?.mode === 'top' && data.total > data.recommendations.length) {
        return (
            <button
                type="button"
                onClick={onZoomIn}
                className={`${chip} max-lg:hidden text-gray-800 hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700`}
            >
                <i aria-hidden="true" className="fa-solid fa-magnifying-glass-plus text-teal-700"></i>
                Showing the top {data.recommendations.length}. Zoom in for all {data.total}
            </button>
        );
    }
    return null;
}
