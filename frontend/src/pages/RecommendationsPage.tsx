import { useEffect, useState, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router';
import type { Pet, PetRecommendations } from '../types';
import type { User } from '../App';
import { SavedRecommendations } from '../components/SavedRecommendations';
import { ServiceReviewsDialog } from '../components/ServiceReviewsDialog';
import { RatingSummary } from '../components/Stars';
import {
    budgetNote,
    categoryIcon,
    matchLabel,
    primaryButtonClass,
    readableTag,
    secondaryButtonClass,
    speciesIcon,
} from '../components/ui';

type Recommendation = PetRecommendations['recommendations'][number];
type SortKey = 'match' | 'rating' | 'price';

const PAGE_SIZE = 5;
const SORT_OPTIONS: { key: SortKey; label: string }[] = [
    { key: 'match', label: 'Best match' },
    { key: 'rating', label: 'Top rated' },
    { key: 'price', label: 'Lowest price' },
];

function sortRecommendations(
    items: Recommendation[],
    sort: SortKey,
): Recommendation[] {
    if (sort === 'match') return items;
    return [...items].sort((a, b) =>
        sort === 'price'
            ? a.service.price - b.service.price
            : b.averageRating - a.averageRating ||
              b.reviewCount - a.reviewCount,
    );
}

// Results are stored with the request they answer, so the page can tell
// when the shown list is for another pet or a shorter limit.
interface Loaded {
    petId: number;
    limit: number;
    data: PetRecommendations;
}

interface RecommendationsPageProps {
    currentUser: User | null;
}

export function RecommendationsPage({ currentUser }: RecommendationsPageProps) {
    const [searchParams, setSearchParams] = useSearchParams();
    const [pets, setPets] = useState<Pet[]>([]);
    const [loadingPets, setLoadingPets] = useState(Boolean(currentUser?.id));
    const [profileError, setProfileError] = useState('');
    const [limit, setLimit] = useState(PAGE_SIZE);
    const [loaded, setLoaded] = useState<Loaded | null>(null);
    const [resultError, setResultError] = useState('');
    const [retryCount, setRetryCount] = useState(0);
    const [sort, setSort] = useState<SortKey>('match');
    const [saving, setSaving] = useState(false);
    const [saveMessage, setSaveMessage] = useState<{
        kind: 'success' | 'error';
        text: string;
    } | null>(null);
    const [savedVersion, setSavedVersion] = useState(0);
    const [reviewsFor, setReviewsFor] = useState<Recommendation | null>(null);

    useEffect(() => {
        if (!currentUser?.id) return;
        const controller = new AbortController();
        fetch(`/api/pet-profile/me?userId=${currentUser.id}`, {
            signal: controller.signal,
        })
            .then((response) => {
                if (!response.ok) throw new Error('Could not load your pets.');
                return response.json() as Promise<Pet[]>;
            })
            .then(setPets)
            .catch((error: unknown) => {
                if (!controller.signal.aborted) {
                    setProfileError(
                        error instanceof Error
                            ? error.message
                            : 'Could not load your pets.',
                    );
                }
            })
            .finally(() => {
                if (!controller.signal.aborted) setLoadingPets(false);
            });
        return () => controller.abort();
    }, [currentUser?.id]);

    // The chosen pet lives in the URL, so a refresh or shared link keeps it.
    const requestedId = Number(searchParams.get('pet'));
    const selectedPet =
        pets.find((pet) => pet.id === requestedId) ?? pets[0] ?? null;
    const selectedPetId = selectedPet?.id ?? null;

    useEffect(() => {
        if (selectedPetId === null) return;
        const controller = new AbortController();
        fetch(`/api/recommendation/pets/${selectedPetId}?limit=${limit}`, {
            signal: controller.signal,
        })
            .then((response) => {
                if (!response.ok)
                    throw new Error(
                        'Recommendations are temporarily unavailable.',
                    );
                return response.json() as Promise<PetRecommendations>;
            })
            .then((data) => setLoaded({ petId: selectedPetId, limit, data }))
            .catch((error: unknown) => {
                if (!controller.signal.aborted) {
                    setResultError(
                        error instanceof Error
                            ? error.message
                            : 'Could not load recommendations.',
                    );
                }
            });
        return () => controller.abort();
    }, [selectedPetId, limit, retryCount]);

    // Results for the shown pet, even while more are loading.
    const results =
        loaded && loaded.petId === selectedPetId ? loaded.data : null;
    const isCurrent = results !== null && loaded?.limit === limit;
    const loadingResults = selectedPet !== null && !isCurrent && !resultError;
    const loadingMore = loadingResults && results !== null;
    const recommendations = results?.recommendations ?? [];
    const sorted = sortRecommendations(recommendations, sort);
    const bestId = recommendations[0]?.service.id;
    // A full page suggests the engine may have more to offer.
    const mightHaveMore = isCurrent && recommendations.length >= limit;
    const hasNeeds = (selectedPet?.needs.length ?? 0) > 0;

    function choosePet(pet: Pet) {
        if (pet.id === selectedPetId) return;
        setLimit(PAGE_SIZE);
        setResultError('');
        setSaveMessage(null);
        setSearchParams({ pet: String(pet.id) }, { replace: true });
    }

    async function saveList() {
        if (!selectedPet || !results) return;
        setSaving(true);
        setSaveMessage(null);
        try {
            const response = await fetch('/api/recommendations', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    petId: selectedPet.id,
                    limit: Math.max(1, results.recommendations.length),
                }),
            });
            if (!response.ok) throw new Error();
            setSavedVersion((version) => version + 1);
            setSaveMessage({
                kind: 'success',
                text: `Saved. You can find it under “Saved lists” below.`,
            });
        } catch {
            setSaveMessage({
                kind: 'error',
                text: 'Could not save this list. Please try again.',
            });
        } finally {
            setSaving(false);
        }
    }

    return (
        <main>
            <header className="mb-6">
                <p className="mb-1 text-sm font-semibold uppercase tracking-wide text-teal-700">
                    For my pet
                </p>
                <h2 className="m-0 text-3xl font-bold text-gray-900">
                    {selectedPet
                        ? `Services picked for ${selectedPet.name}`
                        : 'Services picked for your pet'}
                </h2>
                <p className="mt-2 text-gray-600">
                    We rank services by how well they cover your pet’s care
                    needs, within your budget.
                </p>
            </header>

            {loadingPets && <PetSwitcherSkeleton />}

            {profileError && (
                <p
                    role="alert"
                    className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800"
                >
                    {profileError}
                </p>
            )}

            {!loadingPets && !profileError && pets.length === 0 && (
                <EmptyState
                    icon="fa-paw"
                    title="Add a pet to get recommendations"
                    body="Tell us about your pet’s species, care needs, and budget, and we’ll find services that fit."
                    action={
                        <Link to="/profile" className={primaryButtonClass}>
                            <i aria-hidden="true" className="fa-solid fa-plus mr-2"></i>
                            Add a pet
                        </Link>
                    }
                />
            )}

            {selectedPet && (
                <>
                    {pets.length > 1 && (
                        <div
                            role="group"
                            aria-label="Choose a pet"
                            className="-mx-1 mb-4 flex gap-3 overflow-x-auto px-1 py-1"
                        >
                            {pets.map((pet) => {
                                const active = pet.id === selectedPetId;
                                return (
                                    <button
                                        key={pet.id}
                                        type="button"
                                        aria-pressed={active}
                                        onClick={() => choosePet(pet)}
                                        className={`flex min-h-11 shrink-0 items-center gap-3 rounded-xl border px-4 py-2 text-left transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 ${active ? 'border-teal-600 bg-teal-50 ring-1 ring-teal-600' : 'border-gray-200 bg-white hover:border-teal-400'}`}
                                    >
                                        <span
                                            aria-hidden="true"
                                            className={`flex h-9 w-9 items-center justify-center rounded-full ${active ? 'bg-teal-700 text-white' : 'bg-gray-100 text-gray-600'}`}
                                        >
                                            <i className={`fa-solid ${speciesIcon(pet.species)}`}></i>
                                        </span>
                                        <span>
                                            <span className="block font-semibold text-gray-900">
                                                {pet.name}
                                            </span>
                                            <span className="block text-sm capitalize text-gray-600">
                                                {pet.species}
                                            </span>
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    )}

                    <section
                        aria-label={`What we match for ${selectedPet.name}`}
                        className="mb-8 flex flex-wrap items-start justify-between gap-4 rounded-2xl border border-teal-100 bg-teal-50 p-5"
                    >
                        <div className="min-w-0">
                            <p className="m-0 text-sm font-semibold text-gray-900">
                                Matching on
                            </p>
                            <ul className="mt-2 flex list-none flex-wrap gap-2 p-0">
                                {selectedPet.needs.map((need) => (
                                    <li
                                        key={need}
                                        className="rounded-full border border-teal-200 bg-white px-3 py-1 text-sm capitalize text-teal-900"
                                    >
                                        {readableTag(need)}
                                    </li>
                                ))}
                                {!hasNeeds && (
                                    <li className="text-sm text-gray-700">
                                        No care needs yet
                                    </li>
                                )}
                                <li className="rounded-full border border-gray-200 bg-white px-3 py-1 text-sm text-gray-800">
                                    <i aria-hidden="true" className="fa-solid fa-wallet mr-1.5 text-gray-500"></i>
                                    {selectedPet.maxPrice > 0
                                        ? `Up to $${selectedPet.maxPrice}`
                                        : 'Any price'}
                                </li>
                            </ul>
                        </div>
                        <Link
                            to="/profile"
                            className="inline-flex min-h-11 items-center rounded-lg px-2 font-semibold text-teal-800 underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
                        >
                            <i aria-hidden="true" className="fa-solid fa-pen mr-2 text-sm"></i>
                            Edit needs &amp; budget
                        </Link>
                    </section>

                    {!hasNeeds && (
                        <p className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-900">
                            <i aria-hidden="true" className="fa-solid fa-lightbulb mr-2"></i>
                            {selectedPet.name} has no care needs yet, so these
                            are top-rated services within budget.{' '}
                            <Link to="/profile" className="font-semibold text-amber-900 underline">
                                Add needs
                            </Link>{' '}
                            for better matches.
                        </p>
                    )}

                    <section
                        aria-labelledby="results-heading"
                        aria-busy={loadingResults}
                    >
                        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                            <h3
                                id="results-heading"
                                className="m-0 text-xl font-bold text-gray-900"
                            >
                                {results && recommendations.length > 0
                                    ? `${recommendations.length} ${recommendations.length === 1 ? 'match' : 'matches'}`
                                    : 'Matches'}
                            </h3>
                            {recommendations.length > 1 && (
                                <SortControl value={sort} onChange={setSort} />
                            )}
                        </div>

                        {loadingResults && !results && <ResultsSkeleton />}

                        {resultError && (
                            <div
                                role="alert"
                                className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800"
                            >
                                <p className="m-0">{resultError}</p>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setResultError('');
                                        setRetryCount((count) => count + 1);
                                    }}
                                    className={`${secondaryButtonClass} mt-3`}
                                >
                                    Try again
                                </button>
                            </div>
                        )}

                        {results && !resultError && recommendations.length === 0 && (
                            <EmptyState
                                icon="fa-magnifying-glass"
                                title={`No services fit ${selectedPet.name} yet`}
                                body="Try raising the budget or choosing different care needs. We only show services that cover at least one need and fit the budget."
                                action={
                                    <Link to="/profile" className={primaryButtonClass}>
                                        Edit needs &amp; budget
                                    </Link>
                                }
                            />
                        )}

                        {results && recommendations.length > 0 && (
                            <>
                                <ol className="m-0 grid list-none gap-4 p-0 md:grid-cols-2">
                                    {sorted.map((item) => (
                                        <RecommendationCard
                                            key={item.service.id}
                                            item={item}
                                            pet={selectedPet}
                                            featured={
                                                sort === 'match' &&
                                                item.service.id === bestId
                                            }
                                            best={item.service.id === bestId && hasNeeds}
                                            onShowReviews={() => setReviewsFor(item)}
                                        />
                                    ))}
                                </ol>

                                <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200 bg-gray-50 p-4">
                                    <div className="flex flex-wrap items-center gap-3">
                                        {(mightHaveMore || loadingMore) && (
                                            <button
                                                type="button"
                                                onClick={() => setLimit((value) => Math.min(100, value + PAGE_SIZE))}
                                                disabled={loadingMore}
                                                className={secondaryButtonClass}
                                            >
                                                {loadingMore ? 'Loading...' : 'Show more matches'}
                                            </button>
                                        )}
                                        {!mightHaveMore && !loadingMore && (
                                            <p className="m-0 text-sm text-gray-600">
                                                That’s every service that fits {selectedPet.name}.
                                            </p>
                                        )}
                                    </div>
                                    <button
                                        type="button"
                                        onClick={saveList}
                                        disabled={saving || loadingResults}
                                        className={primaryButtonClass}
                                    >
                                        <i aria-hidden="true" className="fa-regular fa-bookmark mr-2"></i>
                                        {saving ? 'Saving...' : 'Save this list'}
                                    </button>
                                </div>
                                {saveMessage && (
                                    <p
                                        role={saveMessage.kind === 'error' ? 'alert' : 'status'}
                                        className={`mt-3 rounded-lg p-3 ${saveMessage.kind === 'error' ? 'bg-red-50 text-red-800' : 'bg-green-50 text-green-900'}`}
                                    >
                                        {saveMessage.text}
                                    </p>
                                )}
                            </>
                        )}
                    </section>

                    <SavedRecommendations
                        key={selectedPet.id}
                        pet={selectedPet}
                        version={savedVersion}
                    />
                </>
            )}

            {reviewsFor && (
                <ServiceReviewsDialog
                    serviceId={reviewsFor.service.id}
                    title={reviewsFor.service.title}
                    averageRating={reviewsFor.averageRating}
                    reviewCount={reviewsFor.reviewCount}
                    onClose={() => setReviewsFor(null)}
                />
            )}
        </main>
    );
}

interface RecommendationCardProps {
    item: Recommendation;
    pet: Pet;
    featured: boolean;
    best: boolean;
    onShowReviews: () => void;
}

function RecommendationCard({
    item,
    pet,
    featured,
    best,
    onShowReviews,
}: RecommendationCardProps) {
    const { service, score, matchedNeeds, averageRating, reviewCount } = item;
    const percent = Math.round(score * 100);
    const covered = new Set(matchedNeeds);
    const budget = budgetNote(service.price, pet.maxPrice);

    return (
        <li
            className={`flex flex-col rounded-2xl border bg-white p-5 shadow-sm ${featured ? 'border-teal-300 md:col-span-2' : 'border-gray-200'}`}
        >
            <div className="flex items-start gap-4">
                <span
                    aria-hidden="true"
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-lg text-teal-700"
                >
                    <i className={`fa-solid ${categoryIcon(service.category)}`}></i>
                </span>
                <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-semibold uppercase tracking-wide text-teal-700">
                            {service.category}
                        </span>
                        {best && (
                            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-900">
                                <i aria-hidden="true" className="fa-solid fa-award mr-1"></i>
                                Best match
                            </span>
                        )}
                    </div>
                    <h4 className="mt-1 text-lg font-bold leading-snug text-gray-900">
                        {service.title}
                    </h4>
                    <p className="m-0 text-sm text-gray-600">By {service.provider}</p>
                </div>
                <div className="shrink-0 text-right">
                    <strong className="block text-xl text-gray-900">${service.price}</strong>
                    {budget && (
                        <span className="text-xs font-medium text-green-700">{budget}</span>
                    )}
                </div>
            </div>

            <p className="mb-4 mt-3 text-sm text-gray-700">{service.description}</p>

            {pet.needs.length > 0 && (
                <div className={`rounded-xl bg-gray-50 p-3 ${featured ? 'md:flex md:items-center md:gap-6' : ''}`}>
                    <div className={featured ? 'md:w-56 md:shrink-0' : ''}>
                        <div className="flex items-baseline justify-between gap-2 text-sm">
                            <span className="font-semibold text-gray-900">{matchLabel(score)}</span>
                            <span className="text-gray-600">{percent}%</span>
                        </div>
                        <div
                            role="meter"
                            aria-label="Match strength"
                            aria-valuemin={0}
                            aria-valuemax={100}
                            aria-valuenow={percent}
                            className="mt-1.5 h-2 overflow-hidden rounded-full bg-gray-200"
                        >
                            <div
                                className="h-full rounded-full bg-teal-600"
                                style={{ width: `${percent}%` }}
                            ></div>
                        </div>
                    </div>
                    <ul
                        aria-label={`Covers ${covered.size} of ${pet.needs.length} needs`}
                        className="m-0 mt-3 flex list-none flex-wrap gap-x-4 gap-y-1 p-0 text-sm md:mt-0"
                    >
                        {pet.needs.map((need) => {
                            const has = covered.has(need);
                            return (
                                <li
                                    key={need}
                                    className={`capitalize ${has ? 'text-teal-900' : 'text-gray-500'}`}
                                >
                                    <i
                                        aria-hidden="true"
                                        className={`fa-solid mr-1.5 ${has ? 'fa-circle-check text-teal-600' : 'fa-circle-minus text-gray-400'}`}
                                    ></i>
                                    {readableTag(need)}
                                    <span className="sr-only">
                                        {has ? ' (covered)' : ' (not covered)'}
                                    </span>
                                </li>
                            );
                        })}
                    </ul>
                </div>
            )}

            <div className="mt-auto pt-4">
                <RatingSummary
                    averageRating={averageRating}
                    reviewCount={reviewCount}
                    onClick={reviewCount > 0 ? onShowReviews : undefined}
                />
            </div>
        </li>
    );
}

function SortControl({
    value,
    onChange,
}: {
    value: SortKey;
    onChange: (value: SortKey) => void;
}) {
    return (
        <div role="radiogroup" aria-label="Sort matches" className="inline-flex rounded-lg border border-gray-300 bg-white p-0.5">
            {SORT_OPTIONS.map((option) => {
                const active = option.key === value;
                return (
                    <button
                        key={option.key}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        onClick={() => onChange(option.key)}
                        className={`min-h-10 rounded-md px-3 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 ${active ? 'bg-teal-700 text-white' : 'text-gray-700 hover:bg-gray-100'}`}
                    >
                        {option.label}
                    </button>
                );
            })}
        </div>
    );
}

function EmptyState({
    icon,
    title,
    body,
    action,
}: {
    icon: string;
    title: string;
    body: string;
    action?: ReactNode;
}) {
    return (
        <div className="rounded-2xl border border-dashed border-gray-300 bg-white px-6 py-10 text-center">
            <span aria-hidden="true" className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-teal-50 text-xl text-teal-700">
                <i className={`fa-solid ${icon}`}></i>
            </span>
            <p className="mb-1 mt-4 text-lg font-bold text-gray-900">{title}</p>
            <p className="mx-auto mb-5 mt-0 max-w-md text-gray-600">{body}</p>
            {action}
        </div>
    );
}

function PetSwitcherSkeleton() {
    return (
        <div role="status" className="mb-8 animate-pulse space-y-4">
            <span className="sr-only">Loading your pets...</span>
            <div className="flex gap-3">
                <div className="h-14 w-36 rounded-xl bg-gray-100"></div>
                <div className="h-14 w-36 rounded-xl bg-gray-100"></div>
            </div>
            <div className="h-24 rounded-2xl bg-gray-100"></div>
        </div>
    );
}

function ResultsSkeleton() {
    return (
        <div role="status" className="grid animate-pulse gap-4 md:grid-cols-2">
            <span className="sr-only">Finding services...</span>
            {[0, 1, 2].map((index) => (
                <div
                    key={index}
                    className={`rounded-2xl border border-gray-200 p-5 ${index === 0 ? 'md:col-span-2' : ''}`}
                >
                    <div className="flex gap-4">
                        <div className="h-11 w-11 rounded-xl bg-gray-100"></div>
                        <div className="flex-1 space-y-2">
                            <div className="h-3 w-20 rounded bg-gray-100"></div>
                            <div className="h-5 w-48 rounded bg-gray-100"></div>
                        </div>
                    </div>
                    <div className="mt-4 h-16 rounded-xl bg-gray-100"></div>
                </div>
            ))}
        </div>
    );
}
