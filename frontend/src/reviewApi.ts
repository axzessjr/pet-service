import type { Aspects, Review, ServiceRating } from './types';

// The API rejects text IDs, but login returns the user ID as text.
export function ownerIdOf(user: { id: unknown } | null): number | null {
    const id = Number(user?.id);
    return Number.isSafeInteger(id) && id > 0 ? id : null;
}

// Photos are served through the gateway and cached by the browser.
export function photoUrl(photoId: string) {
    return `/api/reviews/photos/${photoId}`;
}

async function request<T>(
    path: string,
    fallback: string,
    init: { method?: string; body?: unknown; signal?: AbortSignal } = {},
): Promise<T> {
    const response = await fetch(`/api${path}`, {
        method: init.method,
        signal: init.signal,
        headers:
            init.body === undefined
                ? undefined
                : { 'Content-Type': 'application/json' },
        body: init.body === undefined ? undefined : JSON.stringify(init.body),
    });
    if (response.status === 204) return undefined as T;
    if (response.status === 413) {
        throw new Error('The photos are too large. Try fewer or smaller photos.');
    }
    const data = await response.json().catch(() => undefined);
    if (!response.ok) {
        // The API explains conflicts like "You already reviewed this service".
        const message = data?.message;
        throw new Error(
            typeof message === 'string'
                ? message
                : Array.isArray(message)
                  ? message.join(' ')
                  : fallback,
        );
    }
    return data as T;
}

export function listRatings(signal?: AbortSignal) {
    return request<ServiceRating[]>('/ratings', 'Could not load ratings.', {
        signal,
    });
}

export function listOwnerReviews(ownerId: number, signal?: AbortSignal) {
    return request<Review[]>(
        `/reviews?ownerId=${ownerId}`,
        'Could not load your reviews.',
        { signal },
    );
}

export function listServiceReviews(serviceId: number, signal?: AbortSignal) {
    return request<Review[]>(
        `/reviews?serviceId=${serviceId}`,
        'Could not load reviews.',
        { signal },
    );
}

// Fields shared by a new review and an edit. Photos are JPEG data URLs.
export type ReviewFields = {
    rating: number;
    aspects: Aspects | null;
    title: string;
    comment: string;
    visitedOn: string | null;
    tags: string[];
    wouldRecommend: boolean | null;
};

export function createReview(
    input: ReviewFields & {
        ownerId: number;
        serviceId: number;
        petId: number | null;
        photos: string[];
    },
) {
    const { petId, aspects, visitedOn, wouldRecommend, ...rest } = input;
    // The API leaves out optional fields that are not set.
    return request<Review>('/reviews', 'Could not post your review.', {
        method: 'POST',
        body: {
            ...rest,
            ...(petId ? { petId } : {}),
            ...(aspects ? { aspects } : {}),
            ...(visitedOn ? { visitedOn } : {}),
            ...(wouldRecommend === null ? {} : { wouldRecommend }),
        },
    });
}

export function updateReview(
    id: string,
    input: ReviewFields & {
        ownerId: number;
        addPhotos: string[];
        removePhotoIds: string[];
    },
) {
    return request<Review>(`/reviews/${id}`, 'Could not update your review.', {
        method: 'PATCH',
        body: input,
    });
}

export function deleteReview(id: string, ownerId: number) {
    return request<void>(
        `/reviews/${id}?ownerId=${ownerId}`,
        'Could not delete your review.',
        { method: 'DELETE' },
    );
}
