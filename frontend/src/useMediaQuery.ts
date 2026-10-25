import { useSyncExternalStore } from 'react';

// True while the media query matches; follows changes such as a resize.
export function useMediaQuery(query: string): boolean {
    return useSyncExternalStore(
        (onChange) => {
            const list = window.matchMedia(query);
            list.addEventListener('change', onChange);
            return () => list.removeEventListener('change', onChange);
        },
        () => window.matchMedia(query).matches,
    );
}

// Tailwind's `lg` breakpoint, where the results panel sits beside the map.
export const DESKTOP_QUERY = '(min-width: 1024px)';
