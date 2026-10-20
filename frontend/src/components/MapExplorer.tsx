import { useEffect, useState } from 'react';
import type { MapRecommendation, MapRecommendations, Pet } from '../types';
import {
    DEBOUNCE_MS,
    filterParams,
    readFilters,
    readPosition,
    useMapRecommendations,
    type MapFilters as Filters,
    type Viewport,
} from '../mapApi';
import { MapFilters } from './MapFilters';
import {
    EmptyState,
    RecommendationCard,
    SortControl,
} from './RecommendationCard';
import { RecommendationMap, type FocusRequest } from './RecommendationMap';
import {
    secondaryButtonClass,
    sortRecommendations,
    type SortKey,
} from './ui';

interface MapExplorerProps {
    pet: Pet;
    params: URLSearchParams;
    updateParams: (patch: Record<string, string | null>) => void;
    onShowReviews: (item: MapRecommendation) => void;
}

export function MapExplorer({
    pet,
    params,
    updateParams,
    onShowReviews,
}: MapExplorerProps) {
    const filters = readFilters(params);
    // The map keeps its own position after it opens; the URL follows it.
    const [initial] = useState(() => readPosition(params));
    const [viewport, setViewport] = useState<Viewport | null>(null);
    const [qInput, setQInput] = useState(filters.q);
    const [priceInput, setPriceInput] = useState(filters.maxPrice);
    const [hoveredId, setHoveredId] = useState<number | null>(null);
    const [focus, setFocus] = useState<FocusRequest | null>(null);
    const [sort, setSort] = useState<SortKey>('match');

    const { data, loading, error, retry } = useMapRecommendations(
        pet.id,
        viewport,
        filters,
    );

    const setFilters = (patch: Partial<Filters>) =>
        updateParams(filterParams(patch));

    // Typing waits for a pause before it searches.
    useEffect(() => {
        if (qInput.trim() === filters.q) return;
        const timer = window.setTimeout(
            () => updateParams(filterParams({ q: qInput })),
            DEBOUNCE_MS,
        );
        return () => window.clearTimeout(timer);
    }, [qInput, filters.q, updateParams]);

    useEffect(() => {
        const valid = priceInput === '' || Number(priceInput) > 0;
        if (!valid || priceInput === filters.maxPrice) return;
        const timer = window.setTimeout(
            () => updateParams(filterParams({ maxPrice: priceInput })),
            DEBOUNCE_MS,
        );
        return () => window.clearTimeout(timer);
    }, [priceInput, filters.maxPrice, updateParams]);

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
        setFilters({
            q: '',
            category: '',
            maxPrice: '',
            minRating: '',
            includeUnmatched: true,
        });
    }

    function scrollToCard(id: number) {
        document
            .getElementById(`map-service-${id}`)
            ?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    const recommendations = data?.recommendations ?? [];
    const sorted = sortRecommendations(recommendations, sort);
    const ranks = new Map(
        recommendations.map((item, index) => [item.service.id, index + 1]),
    );
    const hasFilters =
        Boolean(filters.q || filters.category || filters.maxPrice || filters.minRating) ||
        !filters.includeUnmatched;
    const zoomedOut = data?.mode === 'top';

    return (
        <div>
            <MapFilters
                filters={filters}
                qInput={qInput}
                priceInput={priceInput}
                petMaxPrice={pet.maxPrice}
                onQInput={setQInput}
                onPriceInput={setPriceInput}
                onChange={setFilters}
                onClear={clearFilters}
            />

            <div className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
                <div className="lg:sticky lg:top-4 lg:self-start">
                    <RecommendationMap
                        pet={pet}
                        initialCenter={initial.center}
                        initialZoom={initial.zoom}
                        recommendations={recommendations}
                        mode={data?.mode ?? null}
                        hoveredId={hoveredId}
                        focus={focus}
                        status={
                            <StatusChip
                                data={data}
                                loading={loading}
                                error={error}
                                onRetry={retry}
                            />
                        }
                        onViewportChange={changeViewport}
                        onHover={setHoveredId}
                        onSelect={scrollToCard}
                        onShowReviews={onShowReviews}
                    />
                    <p className="m-0 mt-2 text-xs text-gray-600">
                        <i aria-hidden="true" className="fa-solid fa-circle-info mr-1"></i>
                        Pan or zoom to search a different area. Every pin is
                        also in the list, so you can browse without the map.
                    </p>
                </div>

                <section
                    aria-labelledby="map-results-heading"
                    aria-busy={loading}
                    className="min-w-0"
                >
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                        <h3
                            id="map-results-heading"
                            className="m-0 text-xl font-bold text-gray-900"
                        >
                            {data ? `In this area (${recommendations.length})` : 'In this area'}
                        </h3>
                        {recommendations.length > 1 && (
                            <SortControl value={sort} onChange={setSort} />
                        )}
                    </div>

                    {error && (
                        <div
                            role="alert"
                            className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4 text-red-800"
                        >
                            <p className="m-0">{error}</p>
                            <button
                                type="button"
                                onClick={retry}
                                className={`${secondaryButtonClass} mt-3`}
                            >
                                Try again
                            </button>
                        </div>
                    )}

                    {!data && !error && <ListSkeleton />}

                    {data && recommendations.length === 0 && !error && (
                        <EmptyState
                            icon="fa-map-location-dot"
                            title={
                                hasFilters
                                    ? 'Nothing here matches your filters'
                                    : `No services for ${pet.name} in this area`
                            }
                            body={
                                hasFilters
                                    ? 'Clear some filters, or zoom out to search a wider area.'
                                    : `Zoom out or pan the map to find services that fit ${pet.name}’s species and budget.`
                            }
                            action={
                                hasFilters ? (
                                    <button type="button" onClick={clearFilters} className={secondaryButtonClass}>
                                        Clear all filters
                                    </button>
                                ) : undefined
                            }
                        />
                    )}

                    {recommendations.length > 0 && (
                        <ol className="m-0 grid list-none gap-3 p-0">
                            {sorted.map((item) => {
                                const id = item.service.id;
                                const rank = ranks.get(id);
                                return (
                                    <RecommendationCard
                                        key={id}
                                        id={`map-service-${id}`}
                                        item={item}
                                        pet={pet}
                                        featured={false}
                                        best={rank === 1 && item.matched && pet.needs.length > 0}
                                        rank={zoomedOut ? rank : undefined}
                                        unmatched={!item.matched}
                                        highlighted={hoveredId === id}
                                        onHover={(hovering) => setHoveredId(hovering ? id : null)}
                                        onShowReviews={() => onShowReviews(item)}
                                        actions={
                                            <button
                                                type="button"
                                                onClick={() => setFocus({ id, nonce: Date.now() })}
                                                className="inline-flex min-h-11 items-center rounded-lg px-2 text-sm font-semibold text-teal-800 underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
                                            >
                                                <i aria-hidden="true" className="fa-solid fa-map-pin mr-2"></i>
                                                Show on map
                                            </button>
                                        }
                                    />
                                );
                            })}
                        </ol>
                    )}

                    {zoomedOut && data && data.total > recommendations.length && (
                        <p className="m-0 mt-3 rounded-lg bg-gray-50 p-3 text-sm text-gray-700">
                            {data.total - recommendations.length} more in this area.
                            Zoom in to see them all.
                        </p>
                    )}
                </section>
            </div>
        </div>
    );
}

function StatusChip({
    data,
    loading,
    error,
    onRetry,
}: {
    data: MapRecommendations | null;
    loading: boolean;
    error: string;
    onRetry: () => void;
}) {
    const chip =
        'inline-flex min-h-10 items-center gap-2 rounded-full border bg-white/95 px-3 text-sm font-semibold shadow-sm';
    if (error) {
        return (
            <span className={`${chip} border-red-200 text-red-800`}>
                <i aria-hidden="true" className="fa-solid fa-triangle-exclamation"></i>
                Couldn’t load this area
                <button
                    type="button"
                    onClick={onRetry}
                    className="rounded px-1 underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-700"
                >
                    Retry
                </button>
            </span>
        );
    }
    let text = 'Finding services...';
    if (data) {
        const shown = data.recommendations.length;
        if (data.mode === 'top' && data.total > shown) {
            text = `Showing top ${shown} of ${data.total} in this area · zoom in to see all`;
        } else if (shown < data.total) {
            text = `Showing ${shown} of ${data.total} services in this area`;
        } else {
            text = `${data.total} ${data.total === 1 ? 'service' : 'services'} in this area`;
        }
    }
    return (
        <span role="status" className={`${chip} border-gray-200 text-gray-800`}>
            {loading ? (
                <i aria-hidden="true" className="fa-solid fa-spinner fa-spin text-teal-700"></i>
            ) : (
                <i aria-hidden="true" className="fa-solid fa-location-dot text-teal-700"></i>
            )}
            {text}
        </span>
    );
}

function ListSkeleton() {
    return (
        <div role="status" className="grid animate-pulse gap-3">
            <span className="sr-only">Finding services...</span>
            {[0, 1, 2].map((index) => (
                <div key={index} className="rounded-2xl border border-gray-200 p-5">
                    <div className="flex gap-4">
                        <div className="h-11 w-11 rounded-xl bg-gray-100"></div>
                        <div className="flex-1 space-y-2">
                            <div className="h-3 w-20 rounded bg-gray-100"></div>
                            <div className="h-5 w-40 rounded bg-gray-100"></div>
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
}
