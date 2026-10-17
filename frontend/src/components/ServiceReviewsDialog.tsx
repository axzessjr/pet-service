import { useEffect, useRef, useState } from 'react';
import { listServiceReviews } from '../reviewApi';
import type { AspectKey, Review } from '../types';
import { ReviewDetails } from './ReviewDetails';
import { RatingSummary } from './Stars';
import { ASPECT_LABELS, secondaryButtonClass } from './ui';

// Averages of the optional detail ratings and the share of reviewers who
// would recommend the service, from the reviews shown.
function summarize(reviews: Review[]) {
    const aspects = (Object.keys(ASPECT_LABELS) as AspectKey[])
        .map((key) => {
            const values = reviews
                .map((review) => review.aspects?.[key])
                .filter((value): value is number => value !== undefined);
            return {
                key,
                count: values.length,
                average: values.reduce((sum, value) => sum + value, 0) / (values.length || 1),
            };
        })
        .filter((aspect) => aspect.count > 0);
    const answered = reviews.filter((review) => review.wouldRecommend !== null);
    const yes = answered.filter((review) => review.wouldRecommend).length;
    return {
        aspects,
        recommendPercent: answered.length ? Math.round((yes / answered.length) * 100) : null,
        answered: answered.length,
    };
}

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
    const summary = reviews.length > 0 ? summarize(reviews) : null;

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
            className="w-[calc(100%-2rem)] max-w-2xl rounded-2xl border-0 p-0 shadow-xl backdrop:bg-black/40"
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
                    {!loading && !error && summary && (summary.aspects.length > 0 || summary.recommendPercent !== null) && (
                        <div className="mb-2 rounded-xl bg-gray-50 p-4">
                            {summary.recommendPercent !== null && (
                                <p className="m-0 font-semibold text-gray-900">
                                    <i aria-hidden="true" className="fa-solid fa-thumbs-up mr-2 text-green-700"></i>
                                    {summary.recommendPercent}% would recommend
                                    <span className="font-normal text-gray-600">
                                        {' '}({summary.answered} {summary.answered === 1 ? 'answer' : 'answers'})
                                    </span>
                                </p>
                            )}
                            {summary.aspects.length > 0 && (
                                <dl className="m-0 mt-2 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
                                    {summary.aspects.map((aspect) => (
                                        <div key={aspect.key} className="flex justify-between gap-2">
                                            <dt className="text-gray-600">{ASPECT_LABELS[aspect.key]}</dt>
                                            <dd className="m-0 font-semibold text-gray-900">
                                                {aspect.average.toFixed(1)}/5
                                            </dd>
                                        </div>
                                    ))}
                                </dl>
                            )}
                        </div>
                    )}
                    {!loading && !error && reviews.length > 0 && (
                        <ul className="m-0 list-none divide-y divide-gray-200 p-0">
                            {reviews.map((review) => (
                                <li key={review.id} className="py-4">
                                    <ReviewDetails review={review} />
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
