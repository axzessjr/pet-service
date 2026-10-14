import type { Review, ServiceRating, Usage } from './types';

// The API rejects text IDs, but login returns the user ID as text.
export function ownerIdOf(user: { id: unknown } | null): number | null {
    const id = Number(user?.id);
    return Number.isSafeInteger(id) && id > 0 ? id : null;
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
    const data = await response.json().catch(() => undefined);
    if (!response.ok) {
        // The API explains conflicts like "Only completed usages can be reviewed".
        const message = data?.message;
        throw new Error(typeof message === 'string' ? message : fallback);
    }
    return data as T;
}

export function listRatings(signal?: AbortSignal) {
    return request<ServiceRating[]>('/ratings', 'Could not load ratings.', {
        signal,
    });
}

export function createUsage(ownerId: number, petId: number, serviceId: number) {
    return request<Usage>('/usages', 'Could not book this service.', {
        method: 'POST',
        body: { ownerId, petId, serviceId },
    });
}

export function listUsages(ownerId: number, signal?: AbortSignal) {
    return request<Usage[]>(
        `/usages?ownerId=${ownerId}`,
        'Could not load your bookings.',
        { signal },
    );
}

export function updateUsageStatus(
    id: number,
    ownerId: number,
    status: 'completed' | 'cancelled',
) {
    return request<Usage>(`/usages/${id}`, 'Could not update this booking.', {
        method: 'PATCH',
        body: { ownerId, status },
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

export function createReview(
    usageId: number,
    ownerId: number,
    rating: number,
    comment: string,
) {
    return request<Review>('/reviews', 'Could not post your review.', {
        method: 'POST',
        body: { usageId, ownerId, rating, comment },
    });
}

export function updateReview(
    id: number,
    ownerId: number,
    rating: number,
    comment: string,
) {
    return request<Review>(`/reviews/${id}`, 'Could not update your review.', {
        method: 'PATCH',
        body: { ownerId, rating, comment },
    });
}

export function deleteReview(id: number, ownerId: number) {
    return request<void>(
        `/reviews/${id}?ownerId=${ownerId}`,
        'Could not delete your review.',
        { method: 'DELETE' },
    );
}
