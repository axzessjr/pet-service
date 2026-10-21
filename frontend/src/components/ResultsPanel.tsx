import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { MapRecommendation, MapRecommendations, Pet } from '../types';
import { EmptyState } from './EmptyState';
import { RatingSummary } from './Stars';
import {
    budgetNote,
    categoryColor,
    categoryIcon,
    directionsUrl,
    formatPrice,
    matchLabel,
    matchTone,
    primaryButtonClass,
    readableTag,
    secondaryButtonClass,
    SORT_OPTIONS,
    sortRecommendations,
    UNMATCHED_COLOR,
    type SortKey,
} from './ui';

interface ResultsPanelProps {
    pet: Pet;
    data: MapRecommendations | null;
    loading: boolean;
    error: string;
    onRetry: () => void;
    hasFilters: boolean;
    onClearFilters: () => void;
    canZoomOut: boolean;
    onZoomIn: () => void;
    onZoomOut: () => void;
    hoveredId: number | null;
    onHover: (id: number | null) => void;
    selected: MapRecommendation | null;
    onSelect: (item: MapRecommendation) => void;
    onBack: () => void;
    onShowReviews: (item: MapRecommendation) => void;
    // Beside the map on wide screens; a sheet over the map on phones.
    isDesktop: boolean;
}

// The list beside the map. Choosing a service, here or on the map, swaps
// the list for its details; "All results" swaps back.
export function ResultsPanel({
    pet,
    data,
    loading,
    error,
    onRetry,
    hasFilters,
    onClearFilters,
    canZoomOut,
    onZoomIn,
    onZoomOut,
    hoveredId,
    onHover,
    selected,
    onSelect,
    onBack,
    onShowReviews,
    isDesktop,
}: ResultsPanelProps) {
    const [sort, setSort] = useState<SortKey>('match');
    // Phones only: the sheet shows just the best match until it is opened.
    const [expanded, setExpanded] = useState(false);
    const listRef = useRef<HTMLDivElement>(null);
    const listScroll = useRef(0);
    const lastSelectedId = useRef<number | null>(null);

    const recommendations = data?.recommendations ?? [];
    const ranks = new Map(
        recommendations.map((item, index) => [item.service.id, index + 1]),
    );
    const zoomedOut = data?.mode === 'top';
    const matched = sortRecommendations(
        recommendations.filter((item) => item.matched),
        sort,
    );
    const others = sortRecommendations(
        recommendations.filter((item) => !item.matched),
        sort,
    );
    const ordered = [...matched, ...others];
    const hasNeeds = pet.needs.length > 0;
    const bestId = hasNeeds ? matched.find((item) => ranks.get(item.service.id) === 1)?.service.id : undefined;
    const collapsed = !isDesktop && !expanded;

    // Coming back from a service: restore the list where it was and put
    // focus on the service that was open.
    useLayoutEffect(() => {
        if (selected) {
            lastSelectedId.current = selected.service.id;
            return;
        }
        const id = lastSelectedId.current;
        lastSelectedId.current = null;
        if (id === null) return;
        if (listRef.current) listRef.current.scrollTop = listScroll.current;
        // A collapsed sheet may not show that row; fall back to the heading.
        (
            document.getElementById(`service-row-${id}`) ??
            document.getElementById('results-heading')
        )?.focus({ preventScroll: true });
    }, [selected]);

    let heading = 'Searching this area...';
    if (data) {
        const shown = recommendations.length;
        if (zoomedOut && data.total > shown) {
            heading = `Top ${shown} of ${data.total} in this area`;
        } else if (shown < data.total) {
            heading = `${shown} of ${data.total} in this area`;
        } else {
            heading = `${matched.length} ${matched.length === 1 ? 'match' : 'matches'} in this area`;
        }
    }

    // On phones the sheet floats over the bottom of the map, above the
    // attribution; an open service leaves more of the map in view.
    const panelClass = `absolute inset-x-2 bottom-7 z-10 flex flex-col overflow-hidden rounded-2xl bg-white shadow-xl ring-1 ring-black/10 lg:static lg:z-auto lg:col-start-2 lg:row-start-2 lg:max-h-none lg:rounded-none lg:border-l lg:border-gray-200 lg:shadow-none lg:ring-0 ${selected ? 'max-h-[55%]' : 'max-h-[85%]'}`;

    if (selected) {
        const index = ordered.findIndex(
            (item) => item.service.id === selected.service.id,
        );
        return (
            <section id="results-panel" aria-label={`${selected.service.title} details`} className={panelClass}>
                <ServiceDetail
                    item={selected}
                    pet={pet}
                    rank={zoomedOut ? ranks.get(selected.service.id) : undefined}
                    best={selected.service.id === bestId}
                    position={index >= 0 ? { index, count: ordered.length } : null}
                    onPrevious={() => onSelect(ordered[(index - 1 + ordered.length) % ordered.length])}
                    onNext={() => onSelect(ordered[(index + 1) % ordered.length])}
                    onBack={onBack}
                    onShowReviews={() => onShowReviews(selected)}
                />
            </section>
        );
    }

    const shownMatched = collapsed ? matched.slice(0, 1) : matched;
    const shownOthers = collapsed ? (matched.length === 0 ? others.slice(0, 1) : []) : others;
    const hiddenCount = ordered.length - shownMatched.length - shownOthers.length;

    return (
        <section
            id="results-panel"
            aria-labelledby="results-heading"
            aria-busy={loading}
            className={panelClass}
        >
            <span aria-hidden="true" className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-gray-300 lg:hidden"></span>
            <div className="flex shrink-0 flex-wrap items-center gap-x-2 border-b border-gray-200 py-1 pl-4 pr-2 lg:flex-nowrap lg:py-2">
                <h3 id="results-heading" tabIndex={-1} className="m-0 min-w-0 flex-1 text-base font-bold text-gray-900 focus:outline-none">
                    {heading}
                    {loading && data && (
                        <i aria-hidden="true" className="fa-solid fa-spinner fa-spin ml-2 text-sm text-teal-700"></i>
                    )}
                </h3>
                {!collapsed && recommendations.length > 1 && (
                    <label className="flex shrink-0 items-center gap-1 text-sm text-gray-600 max-lg:order-last max-lg:w-full">
                        <span>Sort</span>
                        <select
                            value={sort}
                            onChange={(event) => setSort(event.target.value as SortKey)}
                            className="min-h-11 rounded-lg border-0 bg-transparent py-1 pl-1 pr-7 font-semibold text-gray-900 hover:bg-gray-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-700"
                        >
                            {SORT_OPTIONS.map((option) => (
                                <option key={option.key} value={option.key}>
                                    {option.label}
                                </option>
                            ))}
                        </select>
                    </label>
                )}
                {!isDesktop && recommendations.length > 1 && (
                    <button
                        type="button"
                        aria-expanded={expanded}
                        aria-controls="results-list"
                        onClick={() => setExpanded((value) => !value)}
                        className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-lg px-3 text-sm font-semibold text-teal-800 hover:bg-teal-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-700"
                    >
                        {expanded ? 'Show map' : 'See all'}
                        <i aria-hidden="true" className={`fa-solid ${expanded ? 'fa-chevron-down' : 'fa-chevron-up'}`}></i>
                    </button>
                )}
            </div>

            <div
                id="results-list"
                ref={listRef}
                onScroll={(event) => {
                    listScroll.current = event.currentTarget.scrollTop;
                }}
                className="min-h-0 flex-1 overflow-y-auto overscroll-contain"
            >
                {error && (
                    <div role="alert" className="m-4 rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">
                        <p className="m-0">{error}</p>
                        <button type="button" onClick={onRetry} className={`${secondaryButtonClass} mt-3`}>
                            Try again
                        </button>
                    </div>
                )}

                {!data && !error && <RowsSkeleton count={collapsed ? 1 : 5} />}

                {data && !error && recommendations.length === 0 && (
                    <EmptyState
                        compact
                        icon="fa-map-location-dot"
                        title={hasFilters ? 'Nothing here matches your filters' : `No services for ${pet.name} here`}
                        body={
                            hasFilters
                                ? 'Clear the filters, or zoom out to search a wider area.'
                                : `Zoom out or move the map to find services that fit ${pet.name}’s species and budget.`
                        }
                        action={
                            <div className="flex flex-wrap justify-center gap-2">
                                {hasFilters && (
                                    <button type="button" onClick={onClearFilters} className={secondaryButtonClass}>
                                        Clear filters
                                    </button>
                                )}
                                {canZoomOut && (
                                    <button type="button" onClick={onZoomOut} className={secondaryButtonClass}>
                                        <i aria-hidden="true" className="fa-solid fa-magnifying-glass-minus mr-2"></i>
                                        Zoom out
                                    </button>
                                )}
                            </div>
                        }
                    />
                )}

                {shownMatched.length > 0 && (
                    <ol className="m-0 list-none divide-y divide-gray-100 p-0">
                        {shownMatched.map((item) => (
                            <ServiceRow
                                key={item.service.id}
                                item={item}
                                pet={pet}
                                rank={zoomedOut ? ranks.get(item.service.id) : undefined}
                                best={item.service.id === bestId}
                                hovered={hoveredId === item.service.id}
                                onHover={onHover}
                                onSelect={onSelect}
                            />
                        ))}
                    </ol>
                )}

                {shownOthers.length > 0 && (
                    <>
                        <h4 className="m-0 border-y border-gray-200 bg-gray-50 px-4 py-2 text-sm font-semibold text-gray-700">
                            Also nearby · doesn’t cover {pet.name}’s needs
                        </h4>
                        <ul className="m-0 list-none divide-y divide-gray-100 p-0">
                            {shownOthers.map((item) => (
                                <ServiceRow
                                    key={item.service.id}
                                    item={item}
                                    pet={pet}
                                    rank={zoomedOut ? ranks.get(item.service.id) : undefined}
                                    best={false}
                                    hovered={hoveredId === item.service.id}
                                    onHover={onHover}
                                    onSelect={onSelect}
                                />
                            ))}
                        </ul>
                    </>
                )}

                {collapsed && hiddenCount > 0 && (
                    <p className="sr-only">
                        {hiddenCount} more. Choose “Show all” to see them.
                    </p>
                )}

                {!collapsed && zoomedOut && data && data.total > recommendations.length && (
                    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700">
                        <span>{data.total - recommendations.length} more in this area.</span>
                        <button
                            type="button"
                            onClick={onZoomIn}
                            className="inline-flex min-h-11 items-center rounded-lg px-2 font-semibold text-teal-800 underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-700"
                        >
                            <i aria-hidden="true" className="fa-solid fa-magnifying-glass-plus mr-2"></i>
                            Zoom in to see all
                        </button>
                    </div>
                )}
            </div>
        </section>
    );
}

interface ServiceRowProps {
    item: MapRecommendation;
    pet: Pet;
    rank: number | undefined;
    best: boolean;
    hovered: boolean;
    onHover: (id: number | null) => void;
    onSelect: (item: MapRecommendation) => void;
}

function ServiceRow({ item, pet, rank, best, hovered, onHover, onSelect }: ServiceRowProps) {
    const { service, score, matched, averageRating, reviewCount } = item;
    const id = service.id;
    return (
        <li>
            <button
                type="button"
                id={`service-row-${id}`}
                onClick={() => onSelect(item)}
                onMouseEnter={() => onHover(id)}
                onMouseLeave={() => onHover(null)}
                onFocus={() => onHover(id)}
                onBlur={() => onHover(null)}
                className={`flex w-full items-start gap-3 px-4 py-3 text-left transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-teal-700 ${hovered ? 'bg-amber-50' : 'bg-white hover:bg-gray-50'}`}
            >
                <CategoryBadge category={service.category} matched={matched} rank={rank} />
                <span className="min-w-0 flex-1">
                    <span className="flex items-start justify-between gap-3">
                        <span className="font-semibold leading-snug text-gray-900">
                            {rank !== undefined && <span className="sr-only">Rank {rank}: </span>}
                            {service.title}
                        </span>
                        <span className="shrink-0 font-bold text-gray-900">{formatPrice(service.price)}</span>
                    </span>
                    <span className="block text-sm text-gray-600">
                        {service.category} · {service.location.district}
                    </span>
                    <span className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                        {best && (
                            <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-900">
                                <i aria-hidden="true" className="fa-solid fa-award mr-1"></i>
                                Best match
                            </span>
                        )}
                        {matched && pet.needs.length > 0 && (
                            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${matchTone(score)}`}>
                                {matchLabel(score)} · {Math.round(score * 100)}%
                            </span>
                        )}
                        <CompactRating averageRating={averageRating} reviewCount={reviewCount} />
                    </span>
                </span>
            </button>
        </li>
    );
}

function CategoryBadge({
    category,
    matched,
    rank,
    large = false,
}: {
    category: string;
    matched: boolean;
    rank?: number;
    large?: boolean;
}) {
    return (
        <span
            aria-hidden="true"
            className={`relative flex shrink-0 items-center justify-center rounded-xl text-white ${large ? 'h-12 w-12 text-xl' : 'h-10 w-10'}`}
            style={{ backgroundColor: matched ? categoryColor(category) : UNMATCHED_COLOR }}
        >
            <i className={`fa-solid ${categoryIcon(category)}`}></i>
            {rank !== undefined && (
                <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full border-2 border-white bg-gray-900 px-1 text-xs font-bold">
                    {rank}
                </span>
            )}
        </span>
    );
}

function CompactRating({ averageRating, reviewCount }: { averageRating: number; reviewCount: number }) {
    if (reviewCount === 0) {
        return <span className="text-gray-500">No reviews yet</span>;
    }
    return (
        <span className="inline-flex items-center gap-1 text-gray-700">
            <i aria-hidden="true" className="fa-solid fa-star text-amber-500"></i>
            <span className="sr-only">Rated</span>
            <span className="font-semibold text-gray-900">{averageRating.toFixed(1)}</span>
            <span className="text-gray-500">
                ({reviewCount}
                <span className="sr-only"> {reviewCount === 1 ? 'review' : 'reviews'}</span>)
            </span>
        </span>
    );
}

interface ServiceDetailProps {
    item: MapRecommendation;
    pet: Pet;
    rank: number | undefined;
    best: boolean;
    // Where the service sits in the list, for previous and next.
    position: { index: number; count: number } | null;
    onPrevious: () => void;
    onNext: () => void;
    onBack: () => void;
    onShowReviews: () => void;
}

function ServiceDetail({
    item,
    pet,
    rank,
    best,
    position,
    onPrevious,
    onNext,
    onBack,
    onShowReviews,
}: ServiceDetailProps) {
    const { service, score, matched, matchedNeeds, averageRating, reviewCount } = item;
    const headingRef = useRef<HTMLHeadingElement>(null);
    const bodyRef = useRef<HTMLDivElement>(null);
    const percent = Math.round(score * 100);
    const covered = new Set(matchedNeeds);
    const budget = budgetNote(service.price, pet.maxPrice);

    // Opening a service moves focus to its name; stepping with previous and
    // next keeps focus on those buttons.
    useEffect(() => {
        headingRef.current?.focus({ preventScroll: true });
    }, []);

    useEffect(() => {
        bodyRef.current?.scrollTo({ top: 0 });
    }, [service.id]);

    const iconButton =
        'flex h-11 w-11 items-center justify-center rounded-lg text-gray-700 hover:bg-gray-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-700';

    return (
        <div
            className="flex min-h-0 flex-1 flex-col"
            onKeyDown={(event) => {
                if (event.key === 'Escape') {
                    event.stopPropagation();
                    onBack();
                }
            }}
        >
            <span aria-hidden="true" className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-gray-300 lg:hidden"></span>
            <div className="flex shrink-0 items-center justify-between gap-2 border-b border-gray-200 px-2 py-1">
                <button
                    type="button"
                    onClick={onBack}
                    className="inline-flex min-h-11 items-center rounded-lg px-2 font-semibold text-teal-800 hover:bg-teal-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-700"
                >
                    <i aria-hidden="true" className="fa-solid fa-arrow-left mr-2"></i>
                    All results
                </button>
                {position && position.count > 1 && (
                    <div className="flex items-center text-sm text-gray-600">
                        <button type="button" onClick={onPrevious} aria-label="Previous service" className={iconButton}>
                            <i aria-hidden="true" className="fa-solid fa-chevron-left"></i>
                        </button>
                        <span aria-live="polite" className="min-w-16 text-center">
                            {position.index + 1} of {position.count}
                        </span>
                        <button type="button" onClick={onNext} aria-label="Next service" className={iconButton}>
                            <i aria-hidden="true" className="fa-solid fa-chevron-right"></i>
                        </button>
                    </div>
                )}
            </div>

            <div ref={bodyRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4">
                <div className="flex items-start gap-3">
                    <CategoryBadge category={service.category} matched={matched} rank={rank} large />
                    <div className="min-w-0 flex-1">
                        <p className="m-0 flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-wide text-teal-700">
                            {service.category}
                            {best && (
                                <span className="rounded-full bg-amber-100 px-2 py-0.5 normal-case tracking-normal text-amber-900">
                                    <i aria-hidden="true" className="fa-solid fa-award mr-1"></i>
                                    Best match
                                </span>
                            )}
                        </p>
                        <h3
                            ref={headingRef}
                            tabIndex={-1}
                            className="m-0 mt-0.5 text-xl font-bold leading-snug text-gray-900 focus:outline-none"
                        >
                            {service.title}
                        </h3>
                        <p className="m-0 text-sm text-gray-600">By {service.provider}</p>
                    </div>
                </div>

                <dl className="m-0 mt-4 grid grid-cols-2 gap-2">
                    <div className="rounded-xl bg-gray-50 p-3">
                        <dt className="text-xs font-semibold uppercase tracking-wide text-gray-600">Price</dt>
                        <dd className="m-0 mt-0.5">
                            <span className="text-lg font-bold text-gray-900">{formatPrice(service.price)}</span>
                            {budget && <span className="block text-xs font-medium text-green-800">{budget}</span>}
                        </dd>
                    </div>
                    <div className="rounded-xl bg-gray-50 p-3">
                        <dt className="text-xs font-semibold uppercase tracking-wide text-gray-600">Rating</dt>
                        <dd className="m-0 mt-1">
                            <RatingSummary averageRating={averageRating} reviewCount={reviewCount} />
                        </dd>
                    </div>
                </dl>

                {matched && pet.needs.length > 0 && (
                    <div className="mt-2 rounded-xl border border-teal-100 bg-teal-50/60 p-3">
                        <div className="flex items-baseline justify-between gap-2 text-sm">
                            <span className="font-semibold text-gray-900">
                                {matchLabel(score)} for {pet.name}
                            </span>
                            <span className="text-gray-700">{percent}%</span>
                        </div>
                        <div
                            role="meter"
                            aria-label="Match strength"
                            aria-valuemin={0}
                            aria-valuemax={100}
                            aria-valuenow={percent}
                            className="mt-1.5 h-2 overflow-hidden rounded-full bg-white"
                        >
                            <div className="h-full rounded-full bg-teal-600" style={{ width: `${percent}%` }}></div>
                        </div>
                        <ul
                            aria-label={`Covers ${covered.size} of ${pet.needs.length} needs`}
                            className="m-0 mt-3 grid list-none grid-cols-2 gap-x-3 gap-y-1 p-0 text-sm"
                        >
                            {pet.needs.map((need) => {
                                const has = covered.has(need);
                                return (
                                    <li key={need} className={`capitalize ${has ? 'text-teal-900' : 'text-gray-500'}`}>
                                        <i
                                            aria-hidden="true"
                                            className={`fa-solid mr-1.5 ${has ? 'fa-circle-check text-teal-600' : 'fa-circle-minus text-gray-400'}`}
                                        ></i>
                                        {readableTag(need)}
                                        <span className="sr-only">{has ? ' (covered)' : ' (not covered)'}</span>
                                    </li>
                                );
                            })}
                        </ul>
                    </div>
                )}

                {!matched && (
                    <p className="m-0 mt-2 rounded-xl bg-gray-100 p-3 text-sm text-gray-700">
                        <i aria-hidden="true" className="fa-solid fa-circle-info mr-1.5 text-gray-500"></i>
                        Nearby, but doesn’t cover any of {pet.name}’s needs.
                    </p>
                )}

                <p className="mb-0 mt-4 text-gray-700">{service.description}</p>
                <p className="mb-0 mt-3 text-sm text-gray-700">
                    <i aria-hidden="true" className="fa-solid fa-location-dot mr-1.5 text-gray-400"></i>
                    {service.location.address}
                </p>

                <div className="mt-5 flex flex-wrap gap-2">
                    <a
                        href={directionsUrl(service.location)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`${primaryButtonClass} inline-flex items-center`}
                    >
                        <i aria-hidden="true" className="fa-solid fa-diamond-turn-right mr-2"></i>
                        Directions
                        <span className="sr-only"> (opens Google Maps in a new tab)</span>
                    </a>
                    {reviewCount > 0 && (
                        <button type="button" onClick={onShowReviews} className={secondaryButtonClass}>
                            <i aria-hidden="true" className="fa-regular fa-comment mr-2"></i>
                            Read {reviewCount} {reviewCount === 1 ? 'review' : 'reviews'}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}

function RowsSkeleton({ count }: { count: number }) {
    return (
        <div role="status" className="animate-pulse divide-y divide-gray-100">
            <span className="sr-only">Finding services...</span>
            {Array.from({ length: count }, (_, index) => (
                <div key={index} className="flex gap-3 px-4 py-3">
                    <div className="h-10 w-10 shrink-0 rounded-xl bg-gray-100"></div>
                    <div className="flex-1 space-y-2">
                        <div className="h-4 w-3/4 rounded bg-gray-100"></div>
                        <div className="h-3 w-1/2 rounded bg-gray-100"></div>
                        <div className="h-4 w-1/3 rounded bg-gray-100"></div>
                    </div>
                </div>
            ))}
        </div>
    );
}
