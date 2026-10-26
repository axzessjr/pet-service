import { useCallback, useSyncExternalStore } from 'react';

// Services an owner bookmarked for one pet, newest first.
//
// For now these live in this browser only (localStorage). When the backend
// gets a saved-services endpoint, swap readIds/writeIds for API calls; the
// hook's shape can stay the same.

const listeners = new Set<() => void>();
const cache = new Map<number, number[]>();
const EMPTY: number[] = [];

const keyFor = (petId: number) => `pawpal:saved-services:pet:${petId}`;

function readIds(petId: number): number[] {
    const cached = cache.get(petId);
    if (cached) return cached;
    let ids: number[] = EMPTY;
    try {
        const raw = localStorage.getItem(keyFor(petId));
        const parsed: unknown = raw ? JSON.parse(raw) : [];
        if (Array.isArray(parsed)) {
            ids = parsed.filter((value): value is number => Number.isSafeInteger(value));
        }
    } catch {
        ids = EMPTY;
    }
    cache.set(petId, ids);
    return ids;
}

function writeIds(petId: number, ids: number[]) {
    cache.set(petId, ids);
    try {
        localStorage.setItem(keyFor(petId), JSON.stringify(ids));
    } catch {
        // Storage blocked: the list still works until the page reloads.
    }
    listeners.forEach((listener) => listener());
}

export function useSavedServices(petId: number) {
    const ids = useSyncExternalStore(
        (onChange) => {
            listeners.add(onChange);
            return () => listeners.delete(onChange);
        },
        () => readIds(petId),
    );

    const isSaved = useCallback((serviceId: number) => ids.includes(serviceId), [ids]);

    const toggle = useCallback(
        (serviceId: number) => {
            const current = readIds(petId);
            writeIds(
                petId,
                current.includes(serviceId)
                    ? current.filter((id) => id !== serviceId)
                    : [serviceId, ...current],
            );
        },
        [petId],
    );

    const remove = useCallback(
        (serviceId: number) =>
            writeIds(petId, readIds(petId).filter((id) => id !== serviceId)),
        [petId],
    );

    return { ids, isSaved, toggle, remove };
}
