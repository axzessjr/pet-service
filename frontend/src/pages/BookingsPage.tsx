import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import type { User } from '../App';
import type { Pet, Review, Usage, UsageStatus } from '../types';
import { ReviewForm } from '../components/ReviewForm';
import { Stars } from '../components/Stars';
import {
    dangerButtonClass,
    dangerTextButtonClass,
    formatDate,
    primaryButtonClass,
    secondaryButtonClass,
} from '../components/ui';
import {
    createReview,
    deleteReview,
    listOwnerReviews,
    listUsages,
    ownerIdOf,
    updateReview,
    updateUsageStatus,
} from '../usageReviewApi';

const STATUS_STYLES: Record<UsageStatus, { label: string; className: string }> = {
    booked: { label: 'Booked', className: 'border-blue-200 bg-blue-50 text-blue-800' },
    completed: { label: 'Completed', className: 'border-green-200 bg-green-50 text-green-800' },
    cancelled: { label: 'Cancelled', className: 'border-gray-200 bg-gray-100 text-gray-700' },
};

type ActionKind = 'complete' | 'cancel' | 'review' | 'delete-review';

interface BookingsPageProps {
    currentUser: User | null;
}

export function BookingsPage({ currentUser }: BookingsPageProps) {
    const ownerId = ownerIdOf(currentUser);
    const [usages, setUsages] = useState<Usage[]>([]);
    // Keyed by usage ID: each usage has at most one review.
    const [reviews, setReviews] = useState<Map<number, Review>>(new Map());
    // null until loaded; pet names are slower to load than bookings.
    const [petNames, setPetNames] = useState<Map<number, string> | null>(null);
    const [loading, setLoading] = useState(ownerId !== null);
    const [loadError, setLoadError] = useState('');
    const [retry, setRetry] = useState(0);
    const [busy, setBusy] = useState<{ usageId: number; kind: ActionKind } | null>(null);
    const [message, setMessage] = useState<{ usageId: number; text: string; error: boolean } | null>(null);
    const [confirm, setConfirm] = useState<{ usageId: number; kind: 'cancel' | 'delete-review' } | null>(null);
    // The usage whose review form (new or edit) is open.
    const [reviewing, setReviewing] = useState<number | null>(null);

    useEffect(() => {
        if (ownerId === null) return;
        const controller = new AbortController();
        Promise.all([
            listUsages(ownerId, controller.signal),
            listOwnerReviews(ownerId, controller.signal),
        ])
            .then(([usageList, reviewList]) => {
                setUsages(usageList);
                setReviews(new Map(reviewList.map((review) => [review.usageId, review])));
            })
            .catch((error: unknown) => {
                if (!controller.signal.aborted) {
                    setLoadError(error instanceof Error ? error.message : 'Could not load your bookings.');
                }
            })
            .finally(() => {
                if (!controller.signal.aborted) setLoading(false);
            });
        return () => controller.abort();
    }, [ownerId, retry]);

    // Pet names are labels only; bookings still show if this fails.
    useEffect(() => {
        if (!currentUser?.id) return;
        const controller = new AbortController();
        fetch(`/api/pet-profile/me?userId=${currentUser.id}`, { signal: controller.signal })
            .then((response) => (response.ok ? (response.json() as Promise<Pet[]>) : []))
            .then((pets) => setPetNames(new Map(pets.map((pet) => [pet.id, pet.name]))))
            .catch(() => undefined);
        return () => controller.abort();
    }, [currentUser?.id]);

    async function run(usageId: number, kind: ActionKind, work: () => Promise<void>, success: string) {
        setBusy({ usageId, kind });
        setMessage(null);
        try {
            await work();
            setConfirm(null);
            setMessage({ usageId, text: success, error: false });
        } catch (error) {
            setMessage({
                usageId,
                text: error instanceof Error ? error.message : 'Something went wrong. Please try again.',
                error: true,
            });
        } finally {
            setBusy(null);
        }
    }

    function replaceUsage(updated: Usage) {
        setUsages((current) => current.map((usage) => (usage.id === updated.id ? updated : usage)));
    }

    function complete(usage: Usage) {
        if (ownerId === null) return;
        void run(usage.id, 'complete', async () => {
            replaceUsage(await updateUsageStatus(usage.id, ownerId, 'completed'));
            setReviewing(usage.id);
        }, 'Marked as completed. How did it go?');
    }

    function cancel(usage: Usage) {
        if (ownerId === null) return;
        void run(usage.id, 'cancel', async () => {
            replaceUsage(await updateUsageStatus(usage.id, ownerId, 'cancelled'));
        }, 'Booking cancelled.');
    }

    function saveReview(usage: Usage, rating: number, comment: string) {
        if (ownerId === null) return;
        const existing = reviews.get(usage.id);
        void run(usage.id, 'review', async () => {
            const saved = existing
                ? await updateReview(existing.id, ownerId, rating, comment)
                : await createReview(usage.id, ownerId, rating, comment);
            setReviews((current) => new Map(current).set(usage.id, saved));
            setReviewing(null);
        }, existing ? 'Review updated.' : 'Thanks! Your review is posted.');
    }

    function removeReview(usage: Usage, review: Review) {
        if (ownerId === null) return;
        void run(usage.id, 'delete-review', async () => {
            await deleteReview(review.id, ownerId);
            setReviews((current) => {
                const next = new Map(current);
                next.delete(usage.id);
                return next;
            });
        }, 'Review deleted.');
    }

    function openReviewForm(usageId: number) {
        setReviewing(usageId);
        setConfirm(null);
        setMessage(null);
    }

    function bookedActions(usage: Usage) {
        const isBusy = busy?.usageId === usage.id;
        if (confirm?.usageId === usage.id && confirm.kind === 'cancel') {
            return (
                <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4">
                    <p className="m-0 font-semibold text-red-900">Cancel this booking?</p>
                    <p className="mb-3 mt-1 text-sm text-red-800">A cancelled booking cannot be reviewed.</p>
                    <div className="flex flex-wrap gap-3">
                        <button type="button" onClick={() => setConfirm(null)} disabled={busy !== null} className={secondaryButtonClass}>
                            Keep booking
                        </button>
                        <button type="button" onClick={() => cancel(usage)} disabled={busy !== null} className={dangerButtonClass}>
                            {isBusy ? 'Cancelling...' : 'Cancel booking'}
                        </button>
                    </div>
                </div>
            );
        }
        return (
            <div className="mt-4 flex flex-wrap gap-3">
                <button type="button" onClick={() => complete(usage)} disabled={busy !== null} className={primaryButtonClass}>
                    {isBusy && busy?.kind === 'complete' ? 'Saving...' : 'Mark as completed'}
                </button>
                <button
                    type="button"
                    onClick={() => {
                        setConfirm({ usageId: usage.id, kind: 'cancel' });
                        setMessage(null);
                    }}
                    disabled={busy !== null}
                    className={dangerTextButtonClass}
                >
                    Cancel booking
                </button>
            </div>
        );
    }

    function reviewArea(usage: Usage) {
        const review = reviews.get(usage.id);
        const isBusy = busy?.usageId === usage.id;

        if (reviewing === usage.id) {
            return (
                <ReviewForm
                    idPrefix={`review-${usage.id}`}
                    initialRating={review?.rating}
                    initialComment={review?.comment}
                    submitLabel={review ? 'Save changes' : 'Post review'}
                    busy={isBusy}
                    onSubmit={(rating, comment) => saveReview(usage, rating, comment)}
                    onCancel={() => setReviewing(null)}
                />
            );
        }

        if (!review) {
            return (
                <div className="mt-4">
                    <button type="button" onClick={() => openReviewForm(usage.id)} disabled={busy !== null} className={primaryButtonClass}>
                        <i aria-hidden="true" className="fa-solid fa-star mr-2"></i>
                        Write a review
                    </button>
                </div>
            );
        }

        return (
            <div className="mt-4 rounded-lg bg-gray-50 p-4">
                <p className="m-0 text-sm font-semibold text-gray-900">Your review</p>
                <div className="mt-1 text-lg">
                    <Stars rating={review.rating} />
                    <span className="sr-only">{review.rating} out of 5 stars</span>
                </div>
                {review.comment && <p className="mb-0 mt-2 whitespace-pre-line text-gray-800">{review.comment}</p>}
                <p className="mb-0 mt-2 text-xs text-gray-500">
                    Posted {formatDate(review.createdAt)}
                    {review.updatedAt !== review.createdAt && ` · Edited ${formatDate(review.updatedAt)}`}
                </p>
                {confirm?.usageId === usage.id && confirm.kind === 'delete-review' ? (
                    <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-4">
                        <p className="m-0 font-semibold text-red-900">Delete your review?</p>
                        <p className="mb-3 mt-1 text-sm text-red-800">You can write a new one afterwards.</p>
                        <div className="flex flex-wrap gap-3">
                            <button type="button" onClick={() => setConfirm(null)} disabled={busy !== null} className={secondaryButtonClass}>
                                Keep review
                            </button>
                            <button type="button" onClick={() => removeReview(usage, review)} disabled={busy !== null} className={dangerButtonClass}>
                                {isBusy ? 'Deleting...' : 'Delete review'}
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="mt-3 flex flex-wrap gap-3">
                        <button type="button" onClick={() => openReviewForm(usage.id)} disabled={busy !== null} className={secondaryButtonClass}>
                            Edit review
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                setConfirm({ usageId: usage.id, kind: 'delete-review' });
                                setMessage(null);
                            }}
                            disabled={busy !== null}
                            className={dangerTextButtonClass}
                        >
                            Delete review
                        </button>
                    </div>
                )}
            </div>
        );
    }

    function usageCard(usage: Usage) {
        const status = STATUS_STYLES[usage.status];
        const petName = petNames && (petNames.get(usage.petId) ?? 'a removed pet');
        return (
            <li key={usage.id} className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                        <h4 className="m-0 text-lg font-bold text-gray-900">{usage.serviceTitle}</h4>
                        <p className="mb-0 mt-1 text-sm text-gray-600">
                            {petName && `For ${petName} · `}
                            {usage.provider} · ${usage.price}
                        </p>
                        <p className="mb-0 mt-1 text-xs text-gray-500">
                            Booked {formatDate(usage.createdAt)}
                            {usage.completedAt && ` · Completed ${formatDate(usage.completedAt)}`}
                        </p>
                    </div>
                    <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${status.className}`}>
                        {status.label}
                    </span>
                </div>
                {usage.status === 'booked' && bookedActions(usage)}
                {usage.status === 'completed' && reviewArea(usage)}
                {message?.usageId === usage.id && (
                    <p
                        role={message.error ? 'alert' : 'status'}
                        className={`mb-0 mt-4 rounded-lg p-3 text-sm ${message.error ? 'bg-red-50 text-red-800' : 'bg-green-50 text-green-900'}`}
                    >
                        {message.text}
                    </p>
                )}
            </li>
        );
    }

    const upcoming = usages.filter((usage) => usage.status === 'booked');
    const history = usages.filter((usage) => usage.status !== 'booked');

    return (
        <main>
            <div className="mb-6">
                <p className="mb-1 text-sm font-semibold uppercase tracking-wide text-teal-700">Your services</p>
                <h2 className="m-0 text-3xl font-bold text-gray-900">My bookings</h2>
                <p className="mt-2 text-gray-600">
                    Mark a booking as completed once the service is done, then rate it. Ratings help rank recommendations.
                </p>
            </div>

            {ownerId === null && (
                <p role="alert" className="rounded-lg bg-red-50 p-4 text-red-800">
                    Log out and sign in again to see your bookings.
                </p>
            )}
            {loading && <p role="status" className="text-gray-600">Loading your bookings...</p>}
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
            {!loading && !loadError && ownerId !== null && usages.length === 0 && (
                <p className="rounded-lg bg-gray-100 p-4 text-gray-700">
                    No bookings yet.{' '}
                    <Link to="/catalog" className="font-semibold text-teal-800 underline">
                        Browse the catalog
                    </Link>{' '}
                    to book a service.
                </p>
            )}

            {!loading && !loadError && upcoming.length > 0 && (
                <section aria-labelledby="upcoming-heading" className="mb-8">
                    <h3 id="upcoming-heading" className="mb-3 text-xl font-bold text-gray-900">
                        Upcoming ({upcoming.length})
                    </h3>
                    <ul className="m-0 list-none space-y-4 p-0">{upcoming.map(usageCard)}</ul>
                </section>
            )}
            {!loading && !loadError && history.length > 0 && (
                <section aria-labelledby="history-heading">
                    <h3 id="history-heading" className="mb-3 text-xl font-bold text-gray-900">
                        History ({history.length})
                    </h3>
                    <ul className="m-0 list-none space-y-4 p-0">{history.map(usageCard)}</ul>
                </section>
            )}
        </main>
    );
}
