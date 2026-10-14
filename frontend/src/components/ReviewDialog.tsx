import { useEffect, useRef, useState } from 'react';
import { createReview, updateReview } from '../reviewApi';
import type { CatalogItem, Pet, Review } from '../types';
import { ReviewForm, type ReviewFormValues } from './ReviewForm';

interface ReviewDialogProps {
    ownerId: number;
    // Present when editing; otherwise a new review starts by choosing one of
    // `services`. An owner can review the same service after every visit.
    review?: Review;
    services?: CatalogItem[];
    // The owner's pets; the form offers those the chosen service supports.
    pets?: Pet[];
    onSaved: (review: Review) => void;
    onClose: () => void;
}

// Mount it to open it. Clicking the backdrop does not close it, so a
// half-written review is not lost by accident.
export function ReviewDialog({
    ownerId,
    review,
    services,
    pets,
    onSaved,
    onClose,
}: ReviewDialogProps) {
    const dialogRef = useRef<HTMLDialogElement>(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        dialogRef.current?.showModal();
    }, []);

    async function save(values: ReviewFormValues) {
        const { serviceId, petId, newPhotos, removePhotoIds, ...fields } = values;
        setBusy(true);
        setError('');
        try {
            const saved = review
                ? await updateReview(review.id, {
                      ...fields,
                      ownerId,
                      addPhotos: newPhotos,
                      removePhotoIds,
                  })
                : await createReview({
                      ...fields,
                      ownerId,
                      // The form does not submit without a service.
                      serviceId: serviceId!,
                      petId,
                      photos: newPhotos,
                  });
            onSaved(saved);
            dialogRef.current?.close();
        } catch (saveError) {
            setError(
                saveError instanceof Error
                    ? saveError.message
                    : 'Could not save your review. Please try again.',
            );
            setBusy(false);
        }
    }

    return (
        <dialog
            ref={dialogRef}
            onClose={onClose}
            onCancel={(event) => {
                if (busy) event.preventDefault();
            }}
            aria-labelledby="review-dialog-title"
            className="w-[calc(100%-2rem)] max-w-2xl rounded-2xl border-0 p-0 shadow-xl backdrop:bg-black/40"
        >
            <div className="max-h-[90vh] overflow-y-auto p-5">
                <div className="mb-4 flex items-start justify-between gap-3">
                    <div>
                        <h3
                            id="review-dialog-title"
                            className="m-0 text-xl font-bold text-gray-900"
                        >
                            {review ? 'Edit your review' : 'Write a review'}
                        </h3>
                        <p className="mb-0 mt-1 text-gray-600">
                            {review
                                ? review.service.title
                                : 'Choose the service you used, then tell others how the visit went.'}
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={() => dialogRef.current?.close()}
                        disabled={busy}
                        aria-label="Close"
                        className="min-h-11 min-w-11 rounded-lg border-0 bg-transparent text-xl text-gray-600 hover:bg-gray-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-700"
                    >
                        <i aria-hidden="true" className="fa-solid fa-xmark"></i>
                    </button>
                </div>
                <ReviewForm
                    idPrefix={review ? `review-${review.id}` : 'review-new'}
                    review={review}
                    services={services}
                    pets={pets}
                    busy={busy}
                    error={error}
                    onSubmit={(values) => void save(values)}
                    onCancel={() => dialogRef.current?.close()}
                />
            </div>
        </dialog>
    );
}
