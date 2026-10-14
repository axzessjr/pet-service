import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import type { User } from '../App';
import type { Review } from '../types';
import { ReviewDetails } from '../components/ReviewDetails';
import { ReviewDialog } from '../components/ReviewDialog';
import {
    dangerButtonClass,
    dangerTextButtonClass,
    secondaryButtonClass,
} from '../components/ui';
import { deleteReview, listOwnerReviews, ownerIdOf } from '../reviewApi';

interface MyReviewsPageProps {
    currentUser: User | null;
}

export function MyReviewsPage({ currentUser }: MyReviewsPageProps) {
    const ownerId = ownerIdOf(currentUser);
    const [reviews, setReviews] = useState<Review[]>([]);
    const [loading, setLoading] = useState(ownerId !== null);
    const [loadError, setLoadError] = useState('');
    const [retry, setRetry] = useState(0);
    const [editing, setEditing] = useState<Review | null>(null);
    const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
    const [deleting, setDeleting] = useState<string | null>(null);
    const [message, setMessage] = useState<{ reviewId: string; text: string; error: boolean } | null>(null);
    const [pageMessage, setPageMessage] = useState('');

    useEffect(() => {
        if (ownerId === null) return;
        const controller = new AbortController();
        listOwnerReviews(ownerId, controller.signal)
            .then(setReviews)
            .catch((error: unknown) => {
                if (!controller.signal.aborted) {
                    setLoadError(error instanceof Error ? error.message : 'Could not load your reviews.');
                }
            })
            .finally(() => {
                if (!controller.signal.aborted) setLoading(false);
            });
        return () => controller.abort();
    }, [ownerId, retry]);

    function saved(review: Review) {
        setReviews((current) => current.map((item) => (item.id === review.id ? review : item)));
        setMessage({ reviewId: review.id, text: 'Review updated.', error: false });
    }

    async function remove(review: Review) {
        if (ownerId === null) return;
        setDeleting(review.id);
        setMessage(null);
        try {
            await deleteReview(review.id, ownerId);
            setReviews((current) => current.filter((item) => item.id !== review.id));
            setConfirmDelete(null);
            setPageMessage(`Your review of ${review.service.title} was deleted.`);
        } catch (error) {
            setMessage({
                reviewId: review.id,
                text: error instanceof Error ? error.message : 'Could not delete your review.',
                error: true,
            });
        } finally {
            setDeleting(null);
        }
    }

    function actions(review: Review) {
        if (confirmDelete === review.id) {
            return (
                <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4">
                    <p className="m-0 font-semibold text-red-900">Delete this review?</p>
                    <p className="mb-3 mt-1 text-sm text-red-800">
                        Its photos are deleted too. You can write a new review afterwards.
                    </p>
                    <div className="flex flex-wrap gap-3">
                        <button
                            type="button"
                            onClick={() => setConfirmDelete(null)}
                            disabled={deleting !== null}
                            className={secondaryButtonClass}
                        >
                            Keep review
                        </button>
                        <button
                            type="button"
                            onClick={() => void remove(review)}
                            disabled={deleting !== null}
                            className={dangerButtonClass}
                        >
                            {deleting === review.id ? 'Deleting...' : 'Delete review'}
                        </button>
                    </div>
                </div>
            );
        }
        return (
            <div className="mt-4 flex flex-wrap gap-3">
                <button
                    type="button"
                    onClick={() => {
                        setEditing(review);
                        setMessage(null);
                        setPageMessage('');
                    }}
                    disabled={deleting !== null}
                    className={secondaryButtonClass}
                >
                    <i aria-hidden="true" className="fa-solid fa-pen mr-2"></i>
                    Edit review
                </button>
                <button
                    type="button"
                    onClick={() => {
                        setConfirmDelete(review.id);
                        setMessage(null);
                        setPageMessage('');
                    }}
                    disabled={deleting !== null}
                    className={dangerTextButtonClass}
                >
                    Delete review
                </button>
            </div>
        );
    }

    return (
        <main>
            <div className="mb-6">
                <p className="mb-1 text-sm font-semibold uppercase tracking-wide text-teal-700">Your experiences</p>
                <h2 className="m-0 text-3xl font-bold text-gray-900">My reviews</h2>
                <p className="mt-2 text-gray-600">
                    After each visit, choose Write a review on the Catalog page. You can review the same service
                    again after every visit. Ratings help rank recommendations for every pet owner.
                </p>
            </div>

            {ownerId === null && (
                <p role="alert" className="rounded-lg bg-red-50 p-4 text-red-800">
                    Log out and sign in again to see your reviews.
                </p>
            )}
            {loading && <p role="status" className="text-gray-600">Loading your reviews...</p>}
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
            {pageMessage && (
                <p role="status" className="mb-4 rounded-lg bg-green-50 p-3 text-sm text-green-900">
                    {pageMessage}
                </p>
            )}
            {!loading && !loadError && ownerId !== null && reviews.length === 0 && (
                <p className="rounded-lg bg-gray-100 p-4 text-gray-700">
                    No reviews yet.{' '}
                    <Link to="/catalog" className="font-semibold text-teal-800 underline">
                        Browse the catalog
                    </Link>{' '}
                    and choose Write a review after you use a service.
                </p>
            )}
            {!loading && !loadError && reviews.length > 0 && (
                <ul className="m-0 list-none space-y-4 p-0">
                    {reviews.map((review) => (
                        <li key={review.id} className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                            <ReviewDetails review={review} showService />
                            {actions(review)}
                            {message?.reviewId === review.id && (
                                <p
                                    role={message.error ? 'alert' : 'status'}
                                    className={`mb-0 mt-4 rounded-lg p-3 text-sm ${message.error ? 'bg-red-50 text-red-800' : 'bg-green-50 text-green-900'}`}
                                >
                                    {message.text}
                                </p>
                            )}
                        </li>
                    ))}
                </ul>
            )}

            {editing && ownerId !== null && (
                <ReviewDialog
                    ownerId={ownerId}
                    review={editing}
                    onSaved={saved}
                    onClose={() => setEditing(null)}
                />
            )}
        </main>
    );
}
