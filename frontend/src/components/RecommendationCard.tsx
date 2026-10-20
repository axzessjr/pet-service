import type { ReactNode } from 'react';
import type { Pet } from '../types';
import { RatingSummary } from './Stars';
import {
    budgetNote,
    categoryColor,
    SORT_OPTIONS,
    type Recommendation,
    type SortKey,
    UNMATCHED_COLOR,
    categoryIcon,
    matchLabel,
    readableTag,
} from './ui';

interface RecommendationCardProps {
    item: Recommendation;
    pet: Pet;
    featured: boolean;
    best: boolean;
    onShowReviews: () => void;
    // Map view extras: the pin's rank number, whether its pin is
    // highlighted, and whether it covers none of the pet's needs.
    rank?: number;
    highlighted?: boolean;
    unmatched?: boolean;
    id?: string;
    onHover?: (hovering: boolean) => void;
    actions?: ReactNode;
}

export function RecommendationCard({
    item,
    pet,
    featured,
    best,
    onShowReviews,
    rank,
    highlighted = false,
    unmatched = false,
    id,
    onHover,
    actions,
}: RecommendationCardProps) {
    const { service, score, matchedNeeds, averageRating, reviewCount } = item;
    const percent = Math.round(score * 100);
    const covered = new Set(matchedNeeds);
    const budget = budgetNote(service.price, pet.maxPrice);

    return (
        <li
            id={id}
            onMouseEnter={onHover && (() => onHover(true))}
            onMouseLeave={onHover && (() => onHover(false))}
            onFocus={onHover && (() => onHover(true))}
            onBlur={onHover && (() => onHover(false))}
            className={`flex scroll-mt-4 flex-col rounded-2xl border bg-white p-5 shadow-sm transition-shadow ${featured ? 'border-teal-300 md:col-span-2' : 'border-gray-200'} ${highlighted ? 'ring-2 ring-amber-400' : ''} ${unmatched ? 'bg-gray-50' : ''}`}
        >
            <div className="flex items-start gap-4">
                <span
                    aria-hidden="true"
                    className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-lg text-white"
                    style={{
                        backgroundColor: unmatched
                            ? UNMATCHED_COLOR
                            : categoryColor(service.category),
                    }}
                >
                    <i className={`fa-solid ${categoryIcon(service.category)}`}></i>
                    {rank !== undefined && (
                        <span className="absolute -right-2 -top-2 flex h-6 min-w-6 items-center justify-center rounded-full border-2 border-white bg-gray-900 px-1 text-xs font-bold">
                            {rank}
                        </span>
                    )}
                </span>
                <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-semibold uppercase tracking-wide text-teal-700">
                            {service.category}
                        </span>
                        {best && (
                            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-900">
                                <i aria-hidden="true" className="fa-solid fa-award mr-1"></i>
                                Best match
                            </span>
                        )}
                    </div>
                    <h4 className="mt-1 text-lg font-bold leading-snug text-gray-900">
                        {rank !== undefined && <span className="sr-only">Rank {rank}: </span>}
                        {service.title}
                    </h4>
                    <p className="m-0 text-sm text-gray-600">By {service.provider}</p>
                    {service.location && (
                        <p className="m-0 mt-0.5 text-sm text-gray-600">
                            <i aria-hidden="true" className="fa-solid fa-location-dot mr-1.5 text-gray-400"></i>
                            {service.location.district}
                        </p>
                    )}
                </div>
                <div className="shrink-0 text-right">
                    <strong className="block text-xl text-gray-900">${service.price}</strong>
                    {budget && (
                        <span className="text-xs font-medium text-green-700">{budget}</span>
                    )}
                </div>
            </div>

            <p className="mb-4 mt-3 text-sm text-gray-700">{service.description}</p>

            {unmatched && (
                <p className="m-0 rounded-xl bg-gray-100 p-3 text-sm text-gray-700">
                    <i aria-hidden="true" className="fa-solid fa-circle-info mr-1.5 text-gray-500"></i>
                    Nearby, but doesn’t cover {pet.name}’s needs.
                </p>
            )}

            {!unmatched && pet.needs.length > 0 && (
                <div className={`rounded-xl bg-gray-50 p-3 ${featured ? 'md:flex md:items-center md:gap-6' : ''}`}>
                    <div className={featured ? 'md:w-56 md:shrink-0' : ''}>
                        <div className="flex items-baseline justify-between gap-2 text-sm">
                            <span className="font-semibold text-gray-900">{matchLabel(score)}</span>
                            <span className="text-gray-600">{percent}%</span>
                        </div>
                        <div
                            role="meter"
                            aria-label="Match strength"
                            aria-valuemin={0}
                            aria-valuemax={100}
                            aria-valuenow={percent}
                            className="mt-1.5 h-2 overflow-hidden rounded-full bg-gray-200"
                        >
                            <div
                                className="h-full rounded-full bg-teal-600"
                                style={{ width: `${percent}%` }}
                            ></div>
                        </div>
                    </div>
                    <ul
                        aria-label={`Covers ${covered.size} of ${pet.needs.length} needs`}
                        className="m-0 mt-3 flex list-none flex-wrap gap-x-4 gap-y-1 p-0 text-sm md:mt-0"
                    >
                        {pet.needs.map((need) => {
                            const has = covered.has(need);
                            return (
                                <li
                                    key={need}
                                    className={`capitalize ${has ? 'text-teal-900' : 'text-gray-500'}`}
                                >
                                    <i
                                        aria-hidden="true"
                                        className={`fa-solid mr-1.5 ${has ? 'fa-circle-check text-teal-600' : 'fa-circle-minus text-gray-400'}`}
                                    ></i>
                                    {readableTag(need)}
                                    <span className="sr-only">
                                        {has ? ' (covered)' : ' (not covered)'}
                                    </span>
                                </li>
                            );
                        })}
                    </ul>
                </div>
            )}

            <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-4">
                <RatingSummary
                    averageRating={averageRating}
                    reviewCount={reviewCount}
                    onClick={reviewCount > 0 ? onShowReviews : undefined}
                />
                {actions}
            </div>
        </li>
    );
}

export function SortControl({
    value,
    onChange,
}: {
    value: SortKey;
    onChange: (value: SortKey) => void;
}) {
    return (
        <div role="radiogroup" aria-label="Sort matches" className="inline-flex rounded-lg border border-gray-300 bg-white p-0.5">
            {SORT_OPTIONS.map((option) => {
                const active = option.key === value;
                return (
                    <button
                        key={option.key}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        onClick={() => onChange(option.key)}
                        className={`min-h-10 rounded-md px-3 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 ${active ? 'bg-teal-700 text-white' : 'text-gray-700 hover:bg-gray-100'}`}
                    >
                        {option.label}
                    </button>
                );
            })}
        </div>
    );
}

export function EmptyState({
    icon,
    title,
    body,
    action,
}: {
    icon: string;
    title: string;
    body: string;
    action?: ReactNode;
}) {
    return (
        <div className="rounded-2xl border border-dashed border-gray-300 bg-white px-6 py-10 text-center">
            <span aria-hidden="true" className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-teal-50 text-xl text-teal-700">
                <i className={`fa-solid ${icon}`}></i>
            </span>
            <p className="mb-1 mt-4 text-lg font-bold text-gray-900">{title}</p>
            <p className="mx-auto mb-5 mt-0 max-w-md text-gray-600">{body}</p>
            {action}
        </div>
    );
}
