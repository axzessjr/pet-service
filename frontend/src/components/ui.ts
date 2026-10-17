import type { AspectKey } from '../types';

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
