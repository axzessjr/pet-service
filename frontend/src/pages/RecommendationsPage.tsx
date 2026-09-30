import { useEffect, useState } from 'react';
import type { Pet, PetRecommendations, UserProfile } from '../types';

function readableTag(tag: string): string {
    return tag.replaceAll('-', ' ');
}

export function RecommendationsPage() {
    const [pets, setPets] = useState<Pet[]>([]);
    const [selectedPetId, setSelectedPetId] = useState<number | null>(null);
    const [results, setResults] = useState<PetRecommendations | null>(null);
    const [loadingPets, setLoadingPets] = useState(true);
    const [loadingResults, setLoadingResults] = useState(false);
    const [profileError, setProfileError] = useState('');
    const [resultError, setResultError] = useState('');
    const [retryCount, setRetryCount] = useState(0);

    useEffect(() => {
        const controller = new AbortController();
        fetch('/api/pet-profile/me', { signal: controller.signal })
            .then((response) => {
                if (!response.ok) throw new Error('Could not load pets.');
                return response.json() as Promise<UserProfile>;
            })
            .then((profile) => {
                setPets(profile.pets);
                setLoadingResults(profile.pets.length > 0);
                setSelectedPetId(profile.pets[0]?.id ?? null);
            })
            .catch((error: unknown) => {
                if (!controller.signal.aborted) {
                    setProfileError(
                        error instanceof Error
                            ? error.message
                            : 'Could not load pets.',
                    );
                }
            })
            .finally(() => {
                if (!controller.signal.aborted) setLoadingPets(false);
            });
        return () => controller.abort();
    }, []);

    useEffect(() => {
        if (selectedPetId === null) return;
        const controller = new AbortController();
        fetch(`/api/recommendation/pets/${selectedPetId}`, {
            signal: controller.signal,
        })
            .then((response) => {
                if (!response.ok)
                    throw new Error(
                        'Recommendations are temporarily unavailable.',
                    );
                return response.json() as Promise<PetRecommendations>;
            })
            .then((data) => setResults(data))
            .catch((error: unknown) => {
                if (!controller.signal.aborted) {
                    setResultError(
                        error instanceof Error
                            ? error.message
                            : 'Could not load recommendations.',
                    );
                }
            })
            .finally(() => {
                if (!controller.signal.aborted) setLoadingResults(false);
            });
        return () => controller.abort();
    }, [selectedPetId, retryCount]);

    const selectedPet = pets.find((pet) => pet.id === selectedPetId);

    return (
        <main>
            <div className="mb-6">
                <p className="mb-1 text-sm font-semibold uppercase tracking-wide text-teal-700">
                    Made for your pet
                </p>
                <h2 className="m-0 text-3xl font-bold text-gray-900">
                    Recommended services
                </h2>
                <p className="mt-2 text-gray-600">
                    Choose a pet to find services that fit their care needs and
                    budget.
                </p>
            </div>

            {loadingPets ? <p role="status">Loading your pets...</p> : null}
            {profileError ? (
                <p
                    role="alert"
                    className="rounded-lg bg-red-50 p-4 text-red-800"
                >
                    {profileError}
                </p>
            ) : null}

            {selectedPet ? (
                <section className="mb-8 rounded-2xl border border-teal-100 bg-teal-50 p-5">
                    <label
                        htmlFor="pet-select"
                        className="mb-2 block font-semibold text-gray-900"
                    >
                        Select a pet
                    </label>
                    <select
                        id="pet-select"
                        value={selectedPetId ?? ''}
                        onChange={(event) => {
                            setResults(null);
                            setResultError('');
                            setLoadingResults(true);
                            setSelectedPetId(Number(event.target.value));
                        }}
                        className="min-h-11 w-full rounded-lg border border-teal-300 bg-white px-3 py-2 text-gray-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 sm:max-w-xs"
                    >
                        {pets.map((pet) => (
                            <option key={pet.id} value={pet.id}>
                                {pet.name} · {pet.species}
                            </option>
                        ))}
                    </select>
                    <p className="mt-3 text-sm text-gray-700">
                        Looking for{' '}
                        {selectedPet.needs.map(readableTag).join(' and ')} · Up
                        to ${selectedPet.maxPrice}
                    </p>
                </section>
            ) : null}

            <section aria-live="polite" aria-busy={loadingResults}>
                {loadingResults ? (
                    <p role="status" className="text-gray-600">
                        Finding services...
                    </p>
                ) : null}
                {resultError ? (
                    <div
                        role="alert"
                        className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800"
                    >
                        <p className="m-0">{resultError}</p>
                        <button
                            type="button"
                            onClick={() => {
                                setResultError('');
                                setLoadingResults(true);
                                setRetryCount((count) => count + 1);
                            }}
                            className="mt-3 min-h-11 rounded-lg bg-red-800 px-4 py-2 font-semibold text-white hover:bg-red-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-800"
                        >
                            Try again
                        </button>
                    </div>
                ) : null}
                {!loadingResults && !resultError && results ? (
                    results.recommendations.length > 0 ? (
                        <div>
                            <h3 className="mb-4 text-xl font-bold text-gray-900">
                                Top picks for {results.pet.name}
                            </h3>
                            <ul className="grid list-none gap-4 p-0 sm:grid-cols-2">
                                {results.recommendations.map(
                                    ({ service, matchedNeeds }) => (
                                        <li
                                            key={service.id}
                                            className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
                                        >
                                            <div className="mb-3 flex items-start justify-between gap-3">
                                                <div>
                                                    <span className="text-xs font-semibold uppercase tracking-wide text-teal-700">
                                                        {service.category}
                                                    </span>
                                                    <h4 className="mt-1 text-lg font-bold text-gray-900">
                                                        {service.title}
                                                    </h4>
                                                </div>
                                                <strong className="whitespace-nowrap text-lg text-green-700">
                                                    ${service.price}
                                                </strong>
                                            </div>
                                            <p className="mb-3 text-sm text-gray-700">
                                                {service.description}
                                            </p>
                                            <p className="mb-2 text-sm text-gray-600">
                                                By {service.provider}
                                            </p>
                                            <p className="m-0 text-sm font-medium text-teal-800">
                                                Matches{' '}
                                                {matchedNeeds
                                                    .map(readableTag)
                                                    .join(' and ')}
                                            </p>
                                        </li>
                                    ),
                                )}
                            </ul>
                        </div>
                    ) : (
                        <p className="rounded-lg bg-gray-100 p-4 text-gray-700">
                            No services match this pet’s needs and budget yet.
                        </p>
                    )
                ) : null}
            </section>
        </main>
    );
}
