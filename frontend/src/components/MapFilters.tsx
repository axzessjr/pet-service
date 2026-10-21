import { useState } from 'react';
import {
    RATING_OPTIONS,
    useCategoriesFor,
    type MapFilters as Filters,
} from '../mapApi';
import type { Pet } from '../types';
import {
    categoryColor,
    categoryIcon,
    controlClass,
    formatPrice,
    UNMATCHED_COLOR,
} from './ui';

interface MapFiltersProps {
    pet: Pet;
    filters: Filters;
    // The text and price boxes update as you type; the search runs once
    // typing pauses.
    qInput: string;
    priceInput: string;
    onQInput: (value: string) => void;
    onPriceInput: (value: string) => void;
    onChange: (patch: Partial<Filters>) => void;
    onClear: () => void;
}

const chipClass =
    'inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-full border px-2.5 text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700';

export function MapFilters({
    pet,
    filters,
    qInput,
    priceInput,
    onQInput,
    onPriceInput,
    onChange,
    onClear,
}: MapFiltersProps) {
    const [open, setOpen] = useState(false);
    const offered = useCategoriesFor(pet.species);
    // A category from a shared link stays visible even if it has nothing
    // for this species, so it can be turned off.
    const categories =
        offered && filters.category && !offered.includes(filters.category)
            ? [...offered, filters.category]
            : offered;
    // Filters hidden behind the "Filters" button, counted on it.
    const hiddenCount =
        (filters.maxPrice ? 1 : 0) +
        (filters.minRating ? 1 : 0) +
        (filters.includeUnmatched ? 0 : 1);
    const anyFilter =
        hiddenCount > 0 || Boolean(filters.q || filters.category);

    return (
        <form
            role="search"
            aria-label="Search services on the map"
            onSubmit={(event) => {
                event.preventDefault();
                onChange({ q: qInput, maxPrice: priceInput });
            }}
            className="shrink-0 space-y-3 border-b border-gray-200 bg-white p-3 lg:col-start-2 lg:row-start-1 lg:border-l"
        >
            <div className="flex gap-2">
                <label className="relative min-w-0 flex-1">
                    <span className="sr-only">Search services</span>
                    <i aria-hidden="true" className="fa-solid fa-magnifying-glass pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"></i>
                    <input
                        type="search"
                        value={qInput}
                        onChange={(event) => onQInput(event.target.value)}
                        placeholder="Grooming, Samyan, overnight..."
                        maxLength={100}
                        className={`${controlClass} w-full pl-9`}
                    />
                </label>
                <button
                    type="button"
                    aria-expanded={open}
                    aria-controls="more-filters"
                    onClick={() => setOpen((value) => !value)}
                    className={`inline-flex min-h-11 shrink-0 items-center gap-2 rounded-lg border px-3 font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 ${open || hiddenCount > 0 ? 'border-teal-600 bg-teal-50 text-teal-900' : 'border-gray-300 bg-white text-gray-800 hover:bg-gray-50'}`}
                >
                    <i aria-hidden="true" className="fa-solid fa-sliders"></i>
                    Filters
                    {hiddenCount > 0 && (
                        <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-teal-700 px-1 text-xs text-white">
                            {hiddenCount}
                            <span className="sr-only"> on</span>
                        </span>
                    )}
                </button>
            </div>

            {/* The categories double as the legend for the pin colours. None
                pressed means every category. */}
            {categories && (
                <div
                    role="group"
                    aria-label="Category"
                    className="scrollbar-none -mx-3 flex gap-1.5 overflow-x-auto px-3 lg:flex-wrap lg:overflow-visible"
                >
                    {categories.map((category) => {
                        const active = filters.category === category;
                        return (
                            <button
                                key={category}
                                type="button"
                                aria-pressed={active}
                                onClick={() => onChange({ category: active ? '' : category })}
                                className={`${chipClass} ${active ? 'border-transparent text-white' : 'border-gray-300 bg-white text-gray-800 hover:border-gray-400'}`}
                                style={active ? { backgroundColor: categoryColor(category) } : undefined}
                            >
                                <i
                                    aria-hidden="true"
                                    className={`fa-solid ${categoryIcon(category)} text-xs`}
                                    style={active ? undefined : { color: categoryColor(category) }}
                                ></i>
                                {category}
                                {active && <i aria-hidden="true" className="fa-solid fa-xmark ml-0.5 text-xs"></i>}
                            </button>
                        );
                    })}
                </div>
            )}

            {open && (
                <div id="more-filters" className="grid grid-cols-2 gap-3 rounded-xl bg-gray-50 p-3">
                    <label className="flex flex-col gap-1 text-sm font-semibold text-gray-800">
                        Max price
                        <span className="relative">
                            <span aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-normal text-gray-500">฿</span>
                            <input
                                type="number"
                                inputMode="decimal"
                                min={1}
                                step="any"
                                value={priceInput}
                                onChange={(event) => onPriceInput(event.target.value)}
                                placeholder={pet.maxPrice > 0 ? String(pet.maxPrice) : 'Any'}
                                aria-describedby="max-price-hint"
                                className={`${controlClass} w-full pl-7 font-normal`}
                            />
                        </span>
                        <span id="max-price-hint" className="text-xs font-normal text-gray-600">
                            {pet.maxPrice > 0
                                ? `${pet.name}’s budget is ${formatPrice(pet.maxPrice)}`
                                : `${pet.name} has no budget limit`}
                        </span>
                    </label>
                    <label className="flex flex-col gap-1 text-sm font-semibold text-gray-800">
                        Rating
                        <select
                            value={filters.minRating}
                            onChange={(event) => onChange({ minRating: event.target.value })}
                            className={`${controlClass} font-normal`}
                        >
                            {RATING_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>
                                    {option.label}
                                </option>
                            ))}
                        </select>
                    </label>
                    {pet.needs.length > 0 && (
                        <label className="col-span-2 flex min-h-11 cursor-pointer items-center gap-2 text-sm text-gray-800">
                            <input
                                type="checkbox"
                                checked={filters.includeUnmatched}
                                onChange={(event) => onChange({ includeUnmatched: event.target.checked })}
                                className="h-4 w-4 shrink-0 accent-teal-700"
                            />
                            <span>
                                <span className="block">
                                    Include services that don’t cover {pet.name}’s needs
                                </span>
                                <span className="block text-xs text-gray-600">
                                    <span
                                        aria-hidden="true"
                                        className="mr-1 inline-block h-2 w-2 rounded-full"
                                        style={{ backgroundColor: UNMATCHED_COLOR }}
                                    ></span>
                                    Shown as grey pins
                                </span>
                            </span>
                        </label>
                    )}
                    {anyFilter && (
                        <div className="col-span-2 flex justify-end border-t border-gray-200 pt-2">
                            <button
                                type="button"
                                onClick={onClear}
                                className="min-h-9 rounded-lg px-2 text-sm font-semibold text-teal-800 underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
                            >
                                Clear all filters
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* Enter in the search box searches right away. */}
            <button type="submit" tabIndex={-1} className="sr-only">
                Search
            </button>
        </form>
    );
}
