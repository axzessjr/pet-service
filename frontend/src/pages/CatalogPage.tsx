import { useState, useEffect, type FormEvent } from 'react';
import { Link } from 'react-router';
import type { CatalogItem, Pet, ServiceRating } from '../types';
import type { User } from '../App';
import { RatingSummary } from '../components/Stars';
import { ServiceReviewsDialog } from '../components/ServiceReviewsDialog';
import {
    controlClass,
    primaryButtonClass,
    secondaryButtonClass,
    speciesLabel,
} from '../components/ui';
import { createUsage, listRatings, ownerIdOf } from '../usageReviewApi';

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
    const [petsLoaded, setPetsLoaded] = useState(false);
    const [petsError, setPetsError] = useState('');
    const [bookingServiceId, setBookingServiceId] = useState<number | null>(
        null,
    );
    const [bookingPetId, setBookingPetId] = useState('');
    const [booking, setBooking] = useState(false);
    const [bookingError, setBookingError] = useState('');
    const [booked, setBooked] = useState<{
        serviceId: number;
        petName: string;
    } | null>(null);
    const [reviewsFor, setReviewsFor] = useState<CatalogItem | null>(null);

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
            .then((data) => {
                setPets(data);
                setPetsLoaded(true);
            })
            .catch(() => {
                if (!controller.signal.aborted) {
                    setPetsError(
                        'Could not load your pets, so booking is unavailable right now.',
                    );
                }
            });
        return () => controller.abort();
    }, [currentUser?.id]);

    const petsFor = (service: CatalogItem) =>
        pets.filter((pet) => service.species.includes(pet.species));

    function openBooking(service: CatalogItem) {
        setBookingServiceId(service.id);
        setBookingPetId(String(petsFor(service)[0]?.id ?? ''));
        setBookingError('');
        setBooked(null);
    }

    async function confirmBooking(
        event: FormEvent<HTMLFormElement>,
        service: CatalogItem,
    ) {
        event.preventDefault();
        const pet = pets.find((item) => item.id === Number(bookingPetId));
        if (!ownerId || !pet) return;
        setBooking(true);
        setBookingError('');
        try {
            await createUsage(ownerId, pet.id, service.id);
            setBookingServiceId(null);
            setBooked({ serviceId: service.id, petName: pet.name });
        } catch (error) {
            setBookingError(
                error instanceof Error
                    ? error.message
                    : 'Could not book this service.',
            );
        } finally {
            setBooking(false);
        }
    }

    function bookingArea(service: CatalogItem) {
        if (booked?.serviceId === service.id) {
            return (
                <p role="status" className="m-0 rounded-lg bg-green-50 p-2 text-sm text-green-900">
                    <i aria-hidden="true" className="fa-solid fa-circle-check mr-1"></i>
                    Booked for {booked.petName}.{' '}
                    <Link to="/bookings" className="font-semibold text-green-900 underline">
                        View my bookings
                    </Link>
                </p>
            );
        }

        if (bookingServiceId === service.id) {
            const eligible = petsFor(service);
            return (
                <form onSubmit={(event) => confirmBooking(event, service)}>
                    <label
                        htmlFor={`book-pet-${service.id}`}
                        className="block text-sm font-semibold text-gray-900"
                    >
                        Book for
                    </label>
                    <select
                        id={`book-pet-${service.id}`}
                        value={bookingPetId}
                        onChange={(event) => setBookingPetId(event.target.value)}
                        disabled={booking}
                        className={`${controlClass} mt-1 w-full`}
                    >
                        {eligible.map((pet) => (
                            <option key={pet.id} value={pet.id}>
                                {pet.name} · {pet.species}
                            </option>
                        ))}
                    </select>
                    {bookingError && (
                        <p role="alert" className="mb-0 mt-2 text-sm text-red-800">
                            {bookingError}
                        </p>
                    )}
                    <div className="mt-2 flex flex-wrap gap-2">
                        <button type="submit" disabled={booking} className={primaryButtonClass}>
                            {booking ? 'Booking...' : 'Confirm'}
                        </button>
                        <button
                            type="button"
                            onClick={() => setBookingServiceId(null)}
                            disabled={booking}
                            className={secondaryButtonClass}
                        >
                            Cancel
                        </button>
                    </div>
                </form>
            );
        }

        if (!ownerId || petsError) return null;
        // Pets load slower than the catalog; keep the button's space meanwhile.
        if (!petsLoaded) {
            return (
                <button type="button" disabled className={`${primaryButtonClass} w-full`}>
                    Book
                </button>
            );
        }
        if (petsFor(service).length === 0) {
            return (
                <p className="m-0 text-sm text-gray-600">
                    <Link to="/profile" className="font-semibold text-teal-800 underline">
                        Add a {service.species.join(' or ')}
                    </Link>{' '}
                    to book this.
                </p>
            );
        }
        return (
            <button
                type="button"
                onClick={() => openBooking(service)}
                disabled={booking}
                className={`${primaryButtonClass} w-full`}
            >
                Book
            </button>
        );
    }

    return (
        <div>
            {/* We use Flexbox here to put the title and the button on the same line */}
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold text-gray-800 m-0">
                    <i className="fa-solid fa-store mr-2 text-blue-500"></i>
                    Available Services
                </h2>

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

            {petsError && (
                <p role="alert" className="mb-4 rounded-lg bg-amber-50 p-3 text-amber-900">
                    {petsError}
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
                                    {bookingArea(service)}
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
        </div>
    );
}
