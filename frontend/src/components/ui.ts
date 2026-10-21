import type { AspectKey, PetRecommendations } from '../types';

// Shared Tailwind classes for form controls and buttons.
export const controlClass =
    'min-h-11 rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700';
export const primaryButtonClass =
    'min-h-11 rounded-lg bg-teal-700 px-4 py-2 font-semibold text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700';
export const secondaryButtonClass =
    'min-h-11 rounded-lg border border-gray-300 bg-white px-4 py-2 font-semibold text-gray-800 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700';
export const dangerButtonClass =
    'min-h-11 rounded-lg bg-red-800 px-4 py-2 font-semibold text-white hover:bg-red-900 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-800';
export const dangerTextButtonClass =
    'min-h-11 rounded-lg px-4 py-2 font-semibold text-red-800 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-800';

export function formatDate(value: string): string {
    const date = new Date(value);
    return Number.isNaN(date.getTime())
        ? 'Date unavailable'
        : date.toLocaleString();
}

export function speciesLabel(species: string[]): string {
    return `For ${species.map((value) => `${value}s`).join(' and ')}`;
}

export function readableTag(tag: string): string {
    return tag.replaceAll('-', ' ');
}

export function speciesIcon(species: string): string {
    const icons: Record<string, string> = { dog: 'fa-dog', cat: 'fa-cat' };
    return icons[species.toLowerCase()] ?? 'fa-paw';
}

export function categoryIcon(category: string): string {
    const icons: Record<string, string> = {
        walking: 'fa-person-walking',
        grooming: 'fa-scissors',
        sitting: 'fa-house',
        training: 'fa-graduation-cap',
        enrichment: 'fa-baseball',
        wellness: 'fa-heart-pulse',
        veterinary: 'fa-stethoscope',
    };
    return icons[category.toLowerCase()] ?? 'fa-paw';
}

export const SERVICE_CATEGORIES = [
    'Walking',
    'Grooming',
    'Sitting',
    'Training',
    'Enrichment',
    'Wellness',
    'Veterinary',
];

// Map pin and card colours; all keep white text readable (4.5:1 or better).
export function categoryColor(category: string): string {
    const colors: Record<string, string> = {
        walking: '#0f766e',
        grooming: '#a21caf',
        sitting: '#1d4ed8',
        training: '#b45309',
        enrichment: '#15803d',
        wellness: '#be123c',
        veterinary: '#6d28d9',
    };
    return colors[category.toLowerCase()] ?? '#374151';
}

// For services that cover none of the pet's needs.
export const UNMATCHED_COLOR = '#6b7280';

// Cosine similarity from the recommender, 0 to 1.
export function matchLabel(score: number): string {
    if (score >= 0.8) return 'Great match';
    if (score >= 0.5) return 'Good match';
    return 'Partial match';
}

// Badge colours for matchLabel, strongest first.
export function matchTone(score: number): string {
    if (score >= 0.8) return 'bg-teal-700 text-white';
    if (score >= 0.5) return 'bg-teal-50 text-teal-900 ring-1 ring-inset ring-teal-200';
    return 'bg-gray-100 text-gray-700';
}

// About the height of the map frame, for its loading placeholder. The frame
// itself measures where it starts and ends at the bottom of the window.
export const mapFrameHeightClass =
    'h-[calc(100svh-19rem)] min-h-[26rem] lg:h-[calc(100svh-14rem)] lg:min-h-[30rem]';

export function directionsUrl(location: { lat: number; lng: number }): string {
    return `https://www.google.com/maps/dir/?api=1&destination=${location.lat},${location.lng}`;
}

// A budget of 0 means the owner set no limit.
export function budgetNote(price: number, maxPrice: number): string {
    if (maxPrice <= 0) return '';
    const left = maxPrice - price;
    return left > 0 ? `$${left} under budget` : 'At budget';
}

export const ASPECT_LABELS: Record<AspectKey, string> = {
    quality: 'Quality of care',
    value: 'Value for money',
    punctuality: 'On time',
    friendliness: 'Friendliness',
};

// For calendar dates such as "2026-10-12", shown in the reader's time zone.
export function formatDay(value: string): string {
    const date = new Date(`${value}T00:00:00`);
    return Number.isNaN(date.getTime())
        ? value
        : date.toLocaleDateString(undefined, { dateStyle: 'medium' });
}

export type Recommendation = PetRecommendations['recommendations'][number];
export type SortKey = 'match' | 'rating' | 'price';

export const SORT_OPTIONS: { key: SortKey; label: string }[] = [
    { key: 'match', label: 'Best match' },
    { key: 'rating', label: 'Top rated' },
    { key: 'price', label: 'Lowest price' },
];

export function sortRecommendations<T extends Recommendation>(
    items: T[],
    sort: SortKey,
): T[] {
    if (sort === 'match') return items;
    return [...items].sort((a, b) =>
        sort === 'price'
            ? a.service.price - b.service.price
            : b.averageRating - a.averageRating ||
              b.reviewCount - a.reviewCount,
    );
}
