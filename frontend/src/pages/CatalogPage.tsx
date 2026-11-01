import { useCallback, useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router';
import type { CatalogItem, Pet, Review, ServiceRating, User } from '../types';
import { EmptyState } from '../components/EmptyState';
import { ReviewDialog } from '../components/ReviewDialog';
import { RatingSummary } from '../components/Stars';
import { ServiceReviewsDialog } from '../components/ServiceReviewsDialog';
import {
    categoryIcon,
    controlClass,
    formatPrice,
    secondaryButtonClass,
    speciesLabel,
} from '../components/ui';
import { listRatings, ownerIdOf } from '../reviewApi';
import { HOME_PATH } from '../routes';

async function loadCatalog(signal?: AbortSignal): Promise<CatalogItem[]> {
    const response = await fetch('/api/catalog', { signal });
    if (!response.ok) throw new Error('Could not load services.');
    return response.json() as Promise<CatalogItem[]>;
}

// Ratings are extra: if the review service is down, still show the catalog.
async function loadRatings(
    signal?: AbortSignal,
): Promise<Map<number, ServiceRating>> {
    try {
        const ratings = await listRatings(signal);
        return new Map(ratings.map((rating) => [rating.serviceId, rating]));
    } catch {
        return new Map();
    }
}

type SortKey = 'rating' | 'reviews' | 'price-asc' | 'price-desc' | 'name';

const SORTS: { key: SortKey; label: string }[] = [
    { key: 'rating', label: 'Top rated' },
    { key: 'reviews', label: 'Most reviewed' },
    { key: 'price-asc', label: 'Price: low to high' },
    { key: 'price-desc', label: 'Price: high to low' },
    { key: 'name', label: 'Name (A–Z)' },
];

const SPECIES = [
    { value: 'dog', label: 'Dogs' },
    { value: 'cat', label: 'Cats' },
];

// Opens "For my pet" at the service, with its details showing.
function mapLink(service: CatalogItem): string {
    const params = new URLSearchParams({
        lat: service.location.lat.toFixed(5),
        lng: service.location.lng.toFixed(5),
        z: '17',
        service: String(service.id),
    });
    return `${HOME_PATH}?${params}`;
}

interface CatalogPageProps {
    currentUser: User | null;
}

export function CatalogPage({ currentUser }: CatalogPageProps) {
    const [services, setServices] = useState<CatalogItem[]>([]);
    const [ratings, setRatings] = useState<Map<number, ServiceRating>>(new Map());
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState('');
    const [retry, setRetry] = useState(0);
    const [pets, setPets] = useState<Pet[]>([]);
    const [reviewsFor, setReviewsFor] = useState<CatalogItem | null>(null);
    const [reviewing, setReviewing] = useState<CatalogItem | null>(null);
    // The review just saved, for the confirmation message.
    const [saved, setSaved] = useState<Review | null>(null);

    // Search, filters and sort live in the URL, so back and refresh keep them.
    const [params, setParams] = useSearchParams();
    const q = params.get('q') ?? '';
    const category = params.get('cat') ?? '';
    const species = params.get('for') ?? '';
    const sort = (SORTS.find((option) => option.key === params.get('sort'))?.key ?? 'rating') as SortKey;
    const [qInput, setQInput] = useState(q);

    const setParam = useCallback(
        (key: string, value: string) =>
            setParams(
                (previous) => {
                    const next = new URLSearchParams(previous);
                    if (value) next.set(key, value);
                    else next.delete(key);
                    return next;
                },
                { replace: true },
            ),
        [setParams],
    );

    // Typing waits for a short pause before it filters.
    useEffect(() => {
        if (qInput.trim() === q) return;
        const timer = window.setTimeout(() => setParam('q', qInput.trim()), 250);
        return () => window.clearTimeout(timer);
    }, [qInput, q, setParam]);

    const ownerId = ownerIdOf(currentUser);

    useEffect(() => {
        const controller = new AbortController();
        Promise.all([loadCatalog(controller.signal), loadRatings(controller.signal)])
            .then(([catalog, serviceRatings]) => {
                if (controller.signal.aborted) return;
                setServices(catalog);
                setRatings(serviceRatings);
            })
            .catch((error: unknown) => {
                if (!controller.signal.aborted) {
                    setLoadError(error instanceof Error ? error.message : 'Could not load services.');
                }
            })
            .finally(() => {
                if (!controller.signal.aborted) setLoading(false);
            });
        return () => controller.abort();
    }, [retry]);

    useEffect(() => {
        if (!currentUser?.id) return;
        const controller = new AbortController();
        fetch(`/api/pet-profile/me?userId=${currentUser.id}`, { signal: controller.signal })
            .then((response) => {
                if (!response.ok) throw new Error('Could not load pets.');
                return response.json() as Promise<Pet[]>;
            })
            .then(setPets)
            // The pet is optional in a review, so the page works without it.
            .catch(() => undefined);
        return () => controller.abort();
    }, [currentUser?.id]);

    function reviewSaved(review: Review) {
        setSaved(review);
        // The new average comes straight from the review service.
        void loadRatings().then(setRatings);
    }

    const categories = [...new Set(services.map((service) => service.category))].sort();
    const needle = q.toLowerCase();
    const shown = services
        .filter((service) =>
            (!needle ||
                [service.title, service.provider, service.description, service.category]
                    .some((text) => text.toLowerCase().includes(needle))) &&
            (!category || service.category === category) &&
            (!species || service.species.includes(species)),
        )
        .sort((a, b) => {
            const ra = ratings.get(a.id);
            const rb = ratings.get(b.id);
            switch (sort) {
                case 'price-asc':
                    return a.price - b.price;
                case 'price-desc':
                    return b.price - a.price;
                case 'name':
                    return a.title.localeCompare(b.title);
                case 'reviews':
                    return (rb?.reviewCount ?? 0) - (ra?.reviewCount ?? 0);
                default:
                    return (
                        (rb?.averageRating ?? 0) - (ra?.averageRating ?? 0) ||
                        (rb?.reviewCount ?? 0) - (ra?.reviewCount ?? 0)
                    );
            }
        });

    const activeFilters = [
        q && { key: 'q', label: `“${q}”`, clear: () => { setQInput(''); setParam('q', ''); } },
        category && { key: 'cat', label: category, clear: () => setParam('cat', '') },
        species && {
            key: 'for',
            label: SPECIES.find((option) => option.value === species)?.label ?? species,
            clear: () => setParam('for', ''),
        },
    ].filter(Boolean) as { key: string; label: string; clear: () => void }[];

    function clearAll() {
        setQInput('');
        setParams(
            (previous) => {
                const next = new URLSearchParams(previous);
                ['q', 'cat', 'for'].forEach((key) => next.delete(key));
                return next;
            },
            { replace: true },
        );
    }

    return (
        <main>
            <div className="mb-5">
                <h2 className="m-0 text-2xl font-bold text-gray-900">Catalog</h2>
                <p className="mb-0 mt-1.5 text-gray-600">
                    Every service on Pawpal. Used one? Leave a review to help other owners.
                </p>
            </div>

            <div
                role="search"
                aria-label="Search and filter services"
                className="mb-3 flex flex-wrap items-end gap-3 rounded-2xl border border-gray-200 bg-gray-50 p-3.5"
            >
                <div className="min-w-0 flex-[2_1_16rem]">
                    <label htmlFor="catalog-q" className="block text-sm font-semibold text-gray-900">Search</label>
                    <div className="relative mt-1">
                        <i aria-hidden="true" className="fa-solid fa-magnifying-glass pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-500"></i>
                        <input
                            id="catalog-q"
                            type="search"
                            value={qInput}
                            onChange={(event) => setQInput(event.target.value)}
                            placeholder="Service, provider or keyword"
                            className={`${controlClass} w-full pl-9`}
                        />
                    </div>
                </div>
                <div className="min-w-0 flex-[1_1_10rem]">
                    <label htmlFor="catalog-cat" className="block text-sm font-semibold text-gray-900">Category</label>
                    <select
                        id="catalog-cat"
                        value={category}
                        onChange={(event) => setParam('cat', event.target.value)}
                        className={`${controlClass} mt-1 w-full`}
                    >
                        <option value="">All categories</option>
                        {categories.map((value) => (
                            <option key={value} value={value}>{value}</option>
                        ))}
                    </select>
                </div>
                <div className="min-w-0 flex-[1_1_8rem]">
                    <label htmlFor="catalog-for" className="block text-sm font-semibold text-gray-900">For</label>
                    <select
                        id="catalog-for"
                        value={species}
                        onChange={(event) => setParam('for', event.target.value)}
                        className={`${controlClass} mt-1 w-full`}
                    >
                        <option value="">Any pet</option>
                        {SPECIES.map((option) => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                    </select>
                </div>
                <div className="min-w-0 flex-[1_1_11rem]">
                    <label htmlFor="catalog-sort" className="block text-sm font-semibold text-gray-900">Sort by</label>
                    <select
                        id="catalog-sort"
                        value={sort}
                        onChange={(event) => setParam('sort', event.target.value === 'rating' ? '' : event.target.value)}
                        className={`${controlClass} mt-1 w-full`}
                    >
                        {SORTS.map((option) => (
                            <option key={option.key} value={option.key}>{option.label}</option>
                        ))}
                    </select>
                </div>
            </div>

            {!loading && !loadError && (
                <div className="mb-5 flex flex-wrap items-center gap-2 text-sm text-gray-600">
                    <p role="status" className="m-0">
                        <strong className="text-gray-900">
                            {shown.length} {shown.length === 1 ? 'service' : 'services'}
                        </strong>
                        {activeFilters.length > 0 ? ' match' : ''}
                    </p>
                    {activeFilters.map((filter) => (
                        <span key={filter.key} className="inline-flex items-center gap-1 rounded-full bg-blue-100 py-0.5 pl-3 pr-1 text-blue-900 ring-1 ring-inset ring-blue-300">
                            {filter.label}
                            <button
                                type="button"
                                onClick={filter.clear}
                                aria-label={`Remove filter ${filter.label}`}
                                className="flex h-7 w-7 items-center justify-center rounded-full border-0 bg-transparent text-blue-900 hover:bg-blue-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-700"
                            >
                                <i aria-hidden="true" className="fa-solid fa-xmark text-xs"></i>
                            </button>
                        </span>
                    ))}
                    {activeFilters.length > 1 && (
                        <button
                            type="button"
                            onClick={clearAll}
                            className="min-h-9 rounded-md border-0 bg-transparent px-1 font-semibold text-teal-800 underline underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-700"
                        >
                            Clear all
                        </button>
                    )}
                </div>
            )}

            {saved && (
                <p role="status" className="mb-4 rounded-lg bg-green-50 p-3 text-green-900">
                    <i aria-hidden="true" className="fa-solid fa-circle-check mr-2"></i>
                    Thanks! Your review of {saved.service.title} is saved.{' '}
                    <Link to="/reviews" className="font-semibold text-green-900 underline">
                        My reviews
                    </Link>
                </p>
            )}

            {loading && <CatalogSkeleton />}

            {loadError && (
                <div role="alert" className="rounded-lg bg-red-50 p-4 text-red-800">
                    <p className="m-0">{loadError}</p>
                    <button
                        type="button"
                        onClick={() => {
                            setLoadError('');
                            setLoading(true);
                            setRetry((count) => count + 1);
                        }}
                        className={`${secondaryButtonClass} mt-3`}
                    >
                        Try again
                    </button>
                </div>
            )}

            {!loading && !loadError && shown.length === 0 && (
                <EmptyState
                    icon="fa-magnifying-glass"
                    title="No services match"
                    body="Try another word, or clear the filters to see every service."
                    action={
                        <button type="button" onClick={clearAll} className={secondaryButtonClass}>
                            Clear filters
                        </button>
                    }
                />
            )}

            {!loading && !loadError && shown.length > 0 && (
                <ul className="m-0 grid list-none grid-cols-1 gap-4 p-0 sm:grid-cols-2 lg:grid-cols-3">
                    {shown.map((service) => {
                        const rating = ratings.get(service.id);
                        return (
                            <li
                                key={service.id}
                                className="flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white p-4"
                            >
                                <div>
                                    <p className="m-0 text-xs font-semibold uppercase tracking-wide text-teal-700">
                                        <i aria-hidden="true" className={`fa-solid ${categoryIcon(service.category)} mr-1.5`}></i>
                                        {service.category} · {speciesLabel(service.species)}
                                    </p>
                                    <h3 className="m-0 mt-1 text-lg font-bold leading-snug text-gray-900">
                                        {service.title}
                                    </h3>
                                    <p className="m-0 text-sm text-gray-600">By {service.provider}</p>
                                    <p className="m-0 mt-2 text-sm text-gray-700">{service.description}</p>
                                </div>
                                <div className="mt-auto flex flex-wrap items-center justify-between gap-2">
                                    <strong className="text-xl font-bold text-gray-900">
                                        {formatPrice(service.price)}
                                    </strong>
                                    <RatingSummary
                                        averageRating={rating?.averageRating ?? 0}
                                        reviewCount={rating?.reviewCount ?? 0}
                                        onClick={() => setReviewsFor(service)}
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-2 border-t border-gray-100 pt-3">
                                    {ownerId ? (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setSaved(null);
                                                setReviewing(service);
                                            }}
                                            className={`${secondaryButtonClass} inline-flex items-center justify-center px-3 text-sm`}
                                        >
                                            <i aria-hidden="true" className="fa-regular fa-star mr-2 text-amber-700"></i>
                                            Review
                                            <span className="sr-only"> {service.title}</span>
                                        </button>
                                    ) : (
                                        <span></span>
                                    )}
                                    <Link
                                        to={mapLink(service)}
                                        className="inline-flex min-h-11 items-center justify-center rounded-lg bg-teal-50 px-3 text-sm font-semibold text-teal-800 no-underline hover:bg-teal-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
                                    >
                                        <i aria-hidden="true" className="fa-solid fa-location-dot mr-2"></i>
                                        Show on map
                                        <span className="sr-only"> for {service.title}</span>
                                    </Link>
                                </div>
                            </li>
                        );
                    })}
                </ul>
            )}

            {reviewsFor && (
                <ServiceReviewsDialog
                    serviceId={reviewsFor.id}
                    title={reviewsFor.title}
                    averageRating={ratings.get(reviewsFor.id)?.averageRating ?? 0}
                    reviewCount={ratings.get(reviewsFor.id)?.reviewCount ?? 0}
                    onClose={() => setReviewsFor(null)}
                />
            )}
            {reviewing && ownerId && (
                <ReviewDialog
                    ownerId={ownerId}
                    services={services}
                    initialServiceId={reviewing.id}
                    pets={pets}
                    onSaved={reviewSaved}
                    onClose={() => setReviewing(null)}
                />
            )}
        </main>
    );
}

function CatalogSkeleton() {
    return (
        <div role="status" className="grid animate-pulse grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <span className="sr-only">Loading services…</span>
            {Array.from({ length: 6 }, (_, index) => (
                <div key={index} className="space-y-3 rounded-2xl border border-gray-200 p-4">
                    <div className="h-3 w-1/3 rounded bg-gray-100"></div>
                    <div className="h-5 w-3/4 rounded bg-gray-100"></div>
                    <div className="h-4 w-1/2 rounded bg-gray-100"></div>
                    <div className="h-11 rounded bg-gray-100"></div>
                </div>
            ))}
        </div>
    );
}
