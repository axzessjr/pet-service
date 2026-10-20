import { RATING_OPTIONS, type MapFilters as Filters } from '../mapApi';
import { controlClass, SERVICE_CATEGORIES } from './ui';

interface MapFiltersProps {
    filters: Filters;
    // The text and price boxes update as you type; the search runs once
    // typing pauses.
    qInput: string;
    priceInput: string;
    petMaxPrice: number;
    onQInput: (value: string) => void;
    onPriceInput: (value: string) => void;
    onChange: (patch: Partial<Filters>) => void;
    onClear: () => void;
}

export function MapFilters({
    filters,
    qInput,
    priceInput,
    petMaxPrice,
    onQInput,
    onPriceInput,
    onChange,
    onClear,
}: MapFiltersProps) {
    const chips: { key: keyof Filters; label: string }[] = [];
    if (filters.q) chips.push({ key: 'q', label: `“${filters.q}”` });
    if (filters.category) chips.push({ key: 'category', label: filters.category });
    if (filters.maxPrice) chips.push({ key: 'maxPrice', label: `Up to $${filters.maxPrice}` });
    if (filters.minRating) chips.push({ key: 'minRating', label: `${filters.minRating}+ stars` });
    if (!filters.includeUnmatched) chips.push({ key: 'includeUnmatched', label: 'Matches only' });

    const removeChip = (key: keyof Filters) => {
        if (key === 'q') onQInput('');
        if (key === 'maxPrice') onPriceInput('');
        onChange(key === 'includeUnmatched' ? { includeUnmatched: true } : { [key]: '' });
    };

    return (
        <form
            role="search"
            aria-label="Search services on the map"
            onSubmit={(event) => {
                event.preventDefault();
                onChange({ q: qInput, maxPrice: priceInput });
            }}
            className="mb-4 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm"
        >
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-[minmax(0,2fr)_repeat(3,minmax(0,1fr))]">
                <label className="flex flex-col gap-1 text-sm font-semibold text-gray-800 col-span-2 lg:col-span-1">
                    Search
                    <span className="relative">
                        <i aria-hidden="true" className="fa-solid fa-magnifying-glass pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"></i>
                        <input
                            type="search"
                            value={qInput}
                            onChange={(event) => onQInput(event.target.value)}
                            placeholder="Groom, Samyan, overnight..."
                            maxLength={100}
                            className={`${controlClass} w-full pl-9 font-normal`}
                        />
                    </span>
                </label>
                <label className="flex flex-col gap-1 text-sm font-semibold text-gray-800">
                    Category
                    <select
                        value={filters.category}
                        onChange={(event) => onChange({ category: event.target.value })}
                        className={`${controlClass} font-normal`}
                    >
                        <option value="">Any category</option>
                        {SERVICE_CATEGORIES.map((category) => (
                            <option key={category} value={category}>
                                {category}
                            </option>
                        ))}
                    </select>
                </label>
                <label className="flex flex-col gap-1 text-sm font-semibold text-gray-800">
                    Max price ($)
                    <input
                        type="number"
                        inputMode="decimal"
                        min={1}
                        step="any"
                        value={priceInput}
                        onChange={(event) => onPriceInput(event.target.value)}
                        placeholder={petMaxPrice > 0 ? `Budget $${petMaxPrice}` : 'Any'}
                        aria-describedby="max-price-hint"
                        className={`${controlClass} font-normal`}
                    />
                    <span id="max-price-hint" className="sr-only">
                        {petMaxPrice > 0
                            ? `Can only lower your pet’s budget of $${petMaxPrice}.`
                            : 'Your pet has no budget limit.'}
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
            </div>

            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 text-sm text-gray-800">
                    <input
                        type="checkbox"
                        checked={filters.includeUnmatched}
                        onChange={(event) => onChange({ includeUnmatched: event.target.checked })}
                        className="h-4 w-4 accent-teal-700"
                    />
                    Also show nearby services that don’t match the needs (grey pins)
                </label>
                {/* Enter in the search box searches right away. */}
                <button type="submit" className="sr-only">
                    Search
                </button>
            </div>

            {chips.length > 0 && (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span className="text-sm text-gray-600">Filters:</span>
                    <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
                        {chips.map((chip) => (
                            <li key={chip.key}>
                                <button
                                    type="button"
                                    onClick={() => removeChip(chip.key)}
                                    aria-label={`Remove filter ${chip.label}`}
                                    className="inline-flex min-h-9 items-center gap-2 rounded-full border border-teal-200 bg-teal-50 px-3 text-sm font-semibold text-teal-900 hover:bg-teal-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
                                >
                                    {chip.label}
                                    <i aria-hidden="true" className="fa-solid fa-xmark"></i>
                                </button>
                            </li>
                        ))}
                    </ul>
                    <button
                        type="button"
                        onClick={onClear}
                        className="min-h-9 rounded-lg px-2 text-sm font-semibold text-teal-800 underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
                    >
                        Clear all
                    </button>
                </div>
            )}
        </form>
    );
}
