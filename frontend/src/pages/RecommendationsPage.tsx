import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import type { MapRecommendation, Pet } from '../types';
import type { User } from '../App';
import { EmptyState } from '../components/EmptyState';
import { SavedListsDrawer } from '../components/SavedRecommendations';
import { ServiceReviewsDialog } from '../components/ServiceReviewsDialog';
import {
    mapFrameHeightClass,
    primaryButtonClass,
    readableTag,
    secondaryButtonClass,
    speciesIcon,
} from '../components/ui';

// Leaflet is downloaded separately, so the header shows while it loads.
const MapExplorer = lazy(() =>
    import('../components/MapExplorer').then((module) => ({
        default: module.MapExplorer,
    })),
);

interface RecommendationsPageProps {
    currentUser: User | null;
}

export function RecommendationsPage({ currentUser }: RecommendationsPageProps) {
    const [searchParams, setSearchParams] = useSearchParams();
    const [pets, setPets] = useState<Pet[]>([]);
    const [loadingPets, setLoadingPets] = useState(Boolean(currentUser?.id));
    const [profileError, setProfileError] = useState('');
    const [reviewsFor, setReviewsFor] = useState<MapRecommendation | null>(null);
    const [savedOpen, setSavedOpen] = useState(false);

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

    // The chosen pet, map position, and map filters live in the URL, so a
    // refresh or shared link keeps them.
    const requestedId = Number(searchParams.get('pet'));
    const selectedPet =
        pets.find((pet) => pet.id === requestedId) ?? pets[0] ?? null;

    const updateParams = useCallback(
        (patch: Record<string, string | null>) =>
            setSearchParams(
                (previous) => {
                    const next = new URLSearchParams(previous);
                    for (const [key, value] of Object.entries(patch)) {
                        if (value === null) next.delete(key);
                        else next.set(key, value);
                    }
                    return next;
                },
                { replace: true },
            ),
        [setSearchParams],
    );

    return (
        <main>
            {loadingPets && <PageSkeleton />}

            {profileError && (
                <p
                    role="alert"
                    className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800"
                >
                    {profileError}
                </p>
            )}

            {!loadingPets && !profileError && pets.length === 0 && (
                <>
                    <h2 className="m-0 mb-6 text-2xl font-bold text-gray-900">
                        Find care for your pet
                    </h2>
                    <EmptyState
                        icon="fa-paw"
                        title="Add a pet to get recommendations"
                        body="Tell us about your pet’s species, care needs, and budget, and we’ll map the services that fit."
                        action={
                            <Link to="/profile" className={`${primaryButtonClass} inline-flex items-center`}>
                                <i aria-hidden="true" className="fa-solid fa-plus mr-2"></i>
                                Add a pet
                            </Link>
                        }
                    />
                </>
            )}

            {selectedPet && (
                <>
                    <header className="mb-4">
                        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
                            <h2 className="m-0 text-2xl font-bold text-gray-900">
                                Find care for {selectedPet.name}
                            </h2>
                            <div className="flex flex-wrap items-center gap-2">
                                {pets.length > 1 && (
                                    <PetSwitcher
                                        pets={pets}
                                        selectedId={selectedPet.id}
                                        onChoose={(pet) => updateParams({ pet: String(pet.id) })}
                                    />
                                )}
                                <button
                                    type="button"
                                    onClick={() => setSavedOpen(true)}
                                    className={`${secondaryButtonClass} inline-flex items-center px-3`}
                                >
                                    <i aria-hidden="true" className="fa-regular fa-bookmark mr-2 text-teal-700"></i>
                                    Saved lists
                                </button>
                            </div>
                        </div>
                        <NeedsSummary pet={selectedPet} />
                    </header>

                    <Suspense fallback={<FrameSkeleton />}>
                        {/* A new pet starts a new search. */}
                        <MapExplorer
                            key={selectedPet.id}
                            pet={selectedPet}
                            params={searchParams}
                            updateParams={updateParams}
                            onShowReviews={setReviewsFor}
                        />
                    </Suspense>

                    {savedOpen && (
                        <SavedListsDrawer
                            pet={selectedPet}
                            onClose={() => setSavedOpen(false)}
                        />
                    )}
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

// What the ranking uses: the pet's needs and budget, with a way to change them.
function NeedsSummary({ pet }: { pet: Pet }) {
    const editLink = (
        <Link
            to="/profile"
            className="inline-flex min-h-9 items-center rounded-lg px-1 font-semibold text-teal-800 underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
        >
            <i aria-hidden="true" className="fa-solid fa-pen mr-1.5 text-xs"></i>
            Edit
            <span className="sr-only"> {pet.name}’s needs and budget</span>
        </Link>
    );
    // One wrapping row, so the chips flow on with the budget on phones.
    return (
        <p className="m-0 mt-1.5 flex flex-wrap items-center gap-x-1.5 gap-y-1.5 text-sm">
            {pet.needs.length > 0 ? (
                <>
                    <span className="mr-0.5 text-gray-600">Matching</span>
                    {pet.needs.map((need, index) => (
                        <span
                            key={need}
                            className="rounded-full bg-teal-50 px-2.5 py-0.5 font-medium capitalize text-teal-900 ring-1 ring-inset ring-teal-200"
                        >
                            {readableTag(need)}
                            {index < pet.needs.length - 1 && <span className="sr-only">,</span>}
                        </span>
                    ))}
                </>
            ) : (
                <span className="text-amber-900">
                    <i aria-hidden="true" className="fa-solid fa-lightbulb mr-1.5"></i>
                    No care needs yet, so these are the top-rated services.
                </span>
            )}
            <span className="ml-0.5 text-gray-600">
                <span aria-hidden="true">·</span>{' '}
                {pet.maxPrice > 0 ? (
                    <>
                        Budget up to <strong className="font-semibold text-gray-900">${pet.maxPrice}</strong>
                    </>
                ) : (
                    'Any budget'
                )}
            </span>
            {editLink}
        </p>
    );
}

function PetSwitcher({
    pets,
    selectedId,
    onChoose,
}: {
    pets: Pet[];
    selectedId: number;
    onChoose: (pet: Pet) => void;
}) {
    return (
        <div
            role="group"
            aria-label="Choose a pet"
            className="flex max-w-full gap-1 overflow-x-auto rounded-xl border border-gray-200 bg-gray-50 p-1"
        >
            {pets.map((pet) => {
                const active = pet.id === selectedId;
                return (
                    <button
                        key={pet.id}
                        type="button"
                        aria-pressed={active}
                        onClick={() => {
                            if (!active) onChoose(pet);
                        }}
                        className={`inline-flex min-h-9 shrink-0 items-center gap-2 rounded-lg px-3 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 ${active ? 'bg-white text-gray-900 shadow-sm ring-1 ring-gray-200' : 'text-gray-600 hover:text-gray-900'}`}
                    >
                        <i
                            aria-hidden="true"
                            className={`fa-solid ${speciesIcon(pet.species)} ${active ? 'text-teal-700' : ''}`}
                        ></i>
                        {pet.name}
                    </button>
                );
            })}
        </div>
    );
}

function FrameSkeleton() {
    return (
        <div
            role="status"
            className={`animate-pulse rounded-2xl border border-gray-200 bg-gray-100 ${mapFrameHeightClass}`}
        >
            <span className="sr-only">Loading the map...</span>
        </div>
    );
}

function PageSkeleton() {
    return (
        <div role="status" className="animate-pulse">
            <span className="sr-only">Loading your pets...</span>
            <div className="mb-2 h-8 w-64 rounded bg-gray-100"></div>
            <div className="mb-4 h-6 w-96 max-w-full rounded bg-gray-100"></div>
            <div className={`rounded-2xl bg-gray-100 ${mapFrameHeightClass}`}></div>
        </div>
    );
}
