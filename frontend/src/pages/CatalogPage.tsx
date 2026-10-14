import { useState, useEffect } from 'react';
import { Link } from 'react-router';
import type { CatalogItem, Pet, Review, ServiceRating } from '../types';
import type { User } from '../App';
import { ReviewDialog } from '../components/ReviewDialog';
import { RatingSummary } from '../components/Stars';
import { ServiceReviewsDialog } from '../components/ServiceReviewsDialog';
import { primaryButtonClass, speciesLabel } from '../components/ui';
import { listRatings, ownerIdOf } from '../reviewApi';

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

interface CatalogPageProps {
    currentUser: User | null;
}

export function CatalogPage({ currentUser }: CatalogPageProps) {
    const [services, setServices] = useState<CatalogItem[]>([]);
    const [ratings, setRatings] = useState<Map<number, ServiceRating>>(
        new Map(),
    );
    const [loading, setLoading] = useState(true);
    const [pets, setPets] = useState<Pet[]>([]);
    const [reviewsFor, setReviewsFor] = useState<CatalogItem | null>(null);
    const [writing, setWriting] = useState(false);
    // The review just saved, for the confirmation message.
    const [saved, setSaved] = useState<Review | null>(null);

    const ownerId = ownerIdOf(currentUser);

    const fetchServices = () => {
        setLoading(true);
        Promise.all([loadCatalog(), loadRatings()])
            .then(([catalog, serviceRatings]) => {
                setServices(catalog);
                setRatings(serviceRatings);
            })
            .catch((error) => {
                console.error('Error fetching catalog services:', error);
            })
            .finally(() => setLoading(false));
    };

    useEffect(() => {
        const controller = new AbortController();
        Promise.all([
            loadCatalog(controller.signal),
            loadRatings(controller.signal),
        ])
            .then(([catalog, serviceRatings]) => {
                if (controller.signal.aborted) return;
                setServices(catalog);
                setRatings(serviceRatings);
            })
            .catch((error) => {
                if (!controller.signal.aborted)
                    console.error('Error fetching catalog services:', error);
            })
            .finally(() => {
                if (!controller.signal.aborted) setLoading(false);
            });
        return () => controller.abort();
    }, []);

    useEffect(() => {
        if (!currentUser?.id) return;
        const controller = new AbortController();
        fetch(`/api/pet-profile/me?userId=${currentUser.id}`, {
            signal: controller.signal,
        })
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

    return (
        <div>
            {/* We use Flexbox here to put the title and the button on the same line */}
            <div className="flex flex-wrap justify-between items-center gap-3 mb-4">
                <h2 className="text-2xl font-bold text-gray-800 m-0">
                    <i className="fa-solid fa-store mr-2 text-blue-500"></i>
                    Available Services
                </h2>

                <div className="flex flex-wrap gap-3">
                    {/* Reviews start by choosing the service that was used, so
                        an owner can review the same service after each visit. */}
                    {ownerId && (
                        <button
                            type="button"
                            onClick={() => {
                                setWriting(true);
                                setSaved(null);
                            }}
                            disabled={services.length === 0}
                            className={primaryButtonClass}
                        >
                            <i aria-hidden="true" className="fa-solid fa-star mr-2"></i>
                            Write a review
                        </button>
                    )}

                    {/* 3. The Refresh Button! */}
                    <button
                        onClick={fetchServices}
                        className="bg-blue-100 hover:bg-blue-200 text-blue-700 font-bold py-2 px-4 rounded-lg transition-colors flex items-center gap-2 cursor-pointer border-0"
                    >
                        <i
                            className={`fa-solid fa-rotate-right ${loading ? 'fa-spin' : ''}`}
                        ></i>
                        Refresh
                    </button>
                </div>
            </div>

            {saved && (
                <p role="status" className="mb-4 rounded-lg bg-green-50 p-3 text-green-900">
                    <i aria-hidden="true" className="fa-solid fa-circle-check mr-2"></i>
                    Thanks! Your review of {saved.service.title} is saved.{' '}
                    <Link to="/reviews" className="font-semibold text-green-900 underline">
                        My reviews
                    </Link>
                </p>
            )}

            {loading ? (
                <p className="text-gray-500 italic">Loading services...</p>
            ) : (
                <ul className="m-0 grid list-none grid-cols-1 gap-3 p-0 sm:grid-cols-2 lg:grid-cols-4">
                    {services.map((service) => {
                        const rating = ratings.get(service.id);
                        return (
                            <li
                                key={service.id}
                                className="py-3 px-4 border rounded-xl flex flex-col justify-between gap-3"
                            >
                                <div>
                                    <strong className="text-lg text-gray-800">
                                        {service.title}
                                    </strong>
                                    <div className="text-sm text-gray-600 mt-1">
                                        By {service.provider}
                                    </div>
                                    <div className="text-sm text-gray-600 mt-1">
                                        {service.category} · {service.description}
                                    </div>
                                    <div className="mt-2 text-xs font-semibold uppercase tracking-wide text-teal-700">
                                        {speciesLabel(service.species)}
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <strong className="block text-green-600 text-xl font-bold">
                                        ${service.price}
                                    </strong>
                                    <RatingSummary
                                        averageRating={rating?.averageRating ?? 0}
                                        reviewCount={rating?.reviewCount ?? 0}
                                        onClick={() => setReviewsFor(service)}
                                    />
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
            {writing && ownerId && (
                <ReviewDialog
                    ownerId={ownerId}
                    services={services}
                    pets={pets}
                    onSaved={reviewSaved}
                    onClose={() => setWriting(false)}
                />
            )}
        </div>
    );
}
