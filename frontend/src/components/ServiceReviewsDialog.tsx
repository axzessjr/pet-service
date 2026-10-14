import { useEffect, useRef, useState } from 'react';
import type { Review } from '../types';
import { listServiceReviews } from '../usageReviewApi';
import { RatingSummary, Stars } from './Stars';
import { formatDate, secondaryButtonClass } from './ui';

interface ServiceReviewsDialogProps {
    serviceId: number;
    title: string;
    averageRating: number;
    reviewCount: number;
    onClose: () => void;
}

// Mount it to open it; it calls onClose on Escape, the close button, or a
// click on the backdrop.
export function ServiceReviewsDialog({
    serviceId,
    title,
    averageRating,
    reviewCount,
    onClose,
}: ServiceReviewsDialogProps) {
    const dialogRef = useRef<HTMLDialogElement>(null);
    const [reviews, setReviews] = useState<Review[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        dialogRef.current?.showModal();
    }, []);

    useEffect(() => {
        const controller = new AbortController();
        listServiceReviews(serviceId, controller.signal)
            .then(setReviews)
            .catch((loadError: unknown) => {
                if (!controller.signal.aborted) {
                    setError(
                        loadError instanceof Error
                            ? loadError.message
                            : 'Could not load reviews.',
                    );
                }
            })
            .finally(() => {
                if (!controller.signal.aborted) setLoading(false);
            });
        return () => controller.abort();
    }, [serviceId]);

    return (
        <dialog
            ref={dialogRef}
            onClose={onClose}
            onClick={(event) => {
                if (event.target === dialogRef.current) dialogRef.current.close();
            }}
            aria-labelledby="reviews-dialog-title"
            className="w-[calc(100%-2rem)] max-w-lg rounded-2xl border-0 p-0 shadow-xl backdrop:bg-black/40"
        >
            <div className="max-h-[80vh] overflow-y-auto p-5">
                <div className="flex items-start justify-between gap-3">
                    <div>
                        <h3
                            id="reviews-dialog-title"
                            className="m-0 text-xl font-bold text-gray-900"
                        >
                            Reviews for {title}
                        </h3>
                        <div className="mt-1">
                            <RatingSummary
                                averageRating={averageRating}
                                reviewCount={reviewCount}
                            />
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={() => dialogRef.current?.close()}
                        aria-label="Close reviews"
                        className="min-h-11 min-w-11 rounded-lg border-0 bg-transparent text-xl text-gray-600 hover:bg-gray-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-700"
                    >
                        <i aria-hidden="true" className="fa-solid fa-xmark"></i>
                    </button>
                </div>

                <div className="mt-4" aria-live="polite" aria-busy={loading}>
                    {loading && (
                        <p role="status" className="text-gray-600">
                            Loading reviews...
                        </p>
                    )}
                    {error && (
                        <p role="alert" className="rounded-lg bg-red-50 p-3 text-red-800">
                            {error}
                        </p>
                    )}
                    {!loading && !error && reviews.length === 0 && (
                        <p className="rounded-lg bg-gray-100 p-4 text-gray-700">
                            No reviews yet.
                        </p>
                    )}
                    {!loading && !error && reviews.length > 0 && (
                        <ul className="m-0 list-none divide-y divide-gray-200 p-0">
                            {reviews.map((review) => (
                                <li key={review.id} className="py-3">
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                        <span>
                                            <Stars rating={review.rating} />
                                            <span className="sr-only">
                                                {review.rating} out of 5 stars
                                            </span>
                                        </span>
                                        <span className="text-xs text-gray-600">
                                            {formatDate(review.createdAt)}
                                        </span>
                                    </div>
                                    {review.comment ? (
                                        <p className="mb-0 mt-2 whitespace-pre-line text-gray-800">
                                            {review.comment}
                                        </p>
                                    ) : (
                                        <p className="mb-0 mt-2 text-sm italic text-gray-500">
                                            No comment
                                        </p>
                                    )}
                                </li>
                            ))}
                        </ul>
                    )}
                </div>

                <div className="mt-4 text-right">
                    <button
                        type="button"
                        onClick={() => dialogRef.current?.close()}
                        className={secondaryButtonClass}
                    >
                        Close
                    </button>
                </div>
            </div>
        </dialog>
    );
}
