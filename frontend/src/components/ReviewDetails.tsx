import { photoUrl } from '../reviewApi';
import type { AspectKey, Review } from '../types';
import { Stars } from './Stars';
import { ASPECT_LABELS, formatDate, formatDay } from './ui';

interface ReviewDetailsProps {
    review: Review;
    // Show which service the review is for (used on "My reviews").
    showService?: boolean;
}

// One review: rating, text, details, tags, and photos.
export function ReviewDetails({ review, showService = false }: ReviewDetailsProps) {
    const aspectEntries = (Object.keys(ASPECT_LABELS) as AspectKey[]).filter(
        (key) => review.aspects?.[key] !== undefined,
    );
    const edited = review.updatedAt !== review.createdAt;

    return (
        <article>
            {showService && (
                <header className="mb-2">
                    <h4 className="m-0 text-lg font-bold text-gray-900">
                        {review.service.title}
                    </h4>
                    <p className="m-0 text-sm text-gray-600">By {review.service.provider}</p>
                </header>
            )}
            <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-lg">
                    <Stars rating={review.rating} />
                    <span className="sr-only">{review.rating} out of 5 stars</span>
                </span>
                <span className="text-xs text-gray-600">
                    {formatDate(review.createdAt)}
                    {edited && ' · Edited'}
                </span>
            </div>
            {review.title && (
                <p className="mb-0 mt-1 font-semibold text-gray-900">{review.title}</p>
            )}
            {(review.pet || review.visitedOn) && (
                <p className="mb-0 mt-1 text-sm text-gray-600">
                    {review.pet && (
                        <>
                            <i aria-hidden="true" className="fa-solid fa-paw mr-1"></i>
                            {review.pet.name} ({review.pet.species})
                        </>
                    )}
                    {review.pet && review.visitedOn && ' · '}
                    {review.visitedOn && `Visited ${formatDay(review.visitedOn)}`}
                </p>
            )}
            {review.comment ? (
                <p className="mb-0 mt-2 whitespace-pre-line text-gray-800">
                    {review.comment}
                </p>
            ) : (
                !review.title && (
                    <p className="mb-0 mt-2 text-sm italic text-gray-500">No comment</p>
                )
            )}
            {aspectEntries.length > 0 && (
                <dl className="m-0 mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                    {aspectEntries.map((key) => (
                        <div key={key} className="flex justify-between gap-2">
                            <dt className="text-gray-600">{ASPECT_LABELS[key]}</dt>
                            <dd className="m-0 font-semibold text-gray-900">
                                {review.aspects?.[key]}/5
                            </dd>
                        </div>
                    ))}
                </dl>
            )}
            {(review.tags.length > 0 || review.wouldRecommend !== null) && (
                <ul className="m-0 mt-2 flex list-none flex-wrap gap-2 p-0">
                    {review.wouldRecommend !== null && (
                        <li
                            className={`rounded-full px-3 py-1 text-xs font-semibold ${review.wouldRecommend ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}
                        >
                            <i
                                aria-hidden="true"
                                className={`fa-solid ${review.wouldRecommend ? 'fa-thumbs-up' : 'fa-thumbs-down'} mr-1`}
                            ></i>
                            {review.wouldRecommend ? 'Would recommend' : 'Would not recommend'}
                        </li>
                    )}
                    {review.tags.map((tag) => (
                        <li
                            key={tag}
                            className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-800"
                        >
                            {tag}
                        </li>
                    ))}
                </ul>
            )}
            {review.photos.length > 0 && (
                <ul className="m-0 mt-3 grid list-none grid-cols-4 gap-2 p-0">
                    {review.photos.map((photo, index) => (
                        <li key={photo.id}>
                            <a
                                href={photoUrl(photo.id)}
                                target="_blank"
                                rel="noreferrer"
                                className="block rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
                            >
                                <img
                                    src={photoUrl(photo.id)}
                                    width={photo.width}
                                    height={photo.height}
                                    loading="lazy"
                                    alt={`Photo ${index + 1} of ${review.photos.length}, opens full size`}
                                    className="aspect-square h-auto w-full rounded-lg object-cover"
                                />
                            </a>
                        </li>
                    ))}
                </ul>
            )}
        </article>
    );
}
