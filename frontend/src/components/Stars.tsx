const STAR_VALUES = [1, 2, 3, 4, 5];
const RATING_WORDS = ['', 'Poor', 'Fair', 'Good', 'Very good', 'Excellent'];

export function Stars({ rating }: { rating: number }) {
    return (
        <span aria-hidden="true" className="whitespace-nowrap text-amber-500">
            {STAR_VALUES.map((value) => (
                <i
                    key={value}
                    className={
                        rating >= value
                            ? 'fa-solid fa-star'
                            : rating >= value - 0.5
                              ? 'fa-solid fa-star-half-stroke'
                              : 'fa-regular fa-star'
                    }
                ></i>
            ))}
        </span>
    );
}

interface RatingSummaryProps {
    averageRating: number;
    reviewCount: number;
    // When set, the summary becomes a button, e.g. to open the reviews.
    onClick?: () => void;
}

export function RatingSummary({
    averageRating,
    reviewCount,
    onClick,
}: RatingSummaryProps) {
    if (reviewCount === 0) {
        return <span className="text-sm text-gray-500">No reviews yet</span>;
    }
    const content = (
        <>
            <Stars rating={averageRating} />
            <span className="sr-only">Rated {averageRating} out of 5,</span>
            <span aria-hidden="true" className="font-semibold text-gray-800">
                {averageRating.toFixed(1)}
            </span>
            <span>
                · {reviewCount} {reviewCount === 1 ? 'review' : 'reviews'}
            </span>
        </>
    );
    return onClick ? (
        <button
            type="button"
            onClick={onClick}
            className="inline-flex flex-wrap items-center gap-1 rounded border-0 bg-transparent p-0 text-left text-sm text-gray-700 underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
        >
            {content}
        </button>
    ) : (
        <span className="inline-flex flex-wrap items-center gap-1 text-sm text-gray-700">
            {content}
        </span>
    );
}

interface StarInputProps {
    name: string;
    value: number;
    onChange: (value: number) => void;
    disabled?: boolean;
    describedBy?: string;
    label?: string;
    // Smaller stars for the optional aspect ratings.
    compact?: boolean;
}

// A 1-5 radio group drawn as stars; arrow keys move between stars.
export function StarInput({
    name,
    value,
    onChange,
    disabled,
    describedBy,
    label = 'Rating',
    compact = false,
}: StarInputProps) {
    return (
        <fieldset className="m-0 border-0 p-0" aria-describedby={describedBy}>
            <legend className={compact ? 'text-sm text-gray-800' : 'font-semibold text-gray-900'}>
                {label}
            </legend>
            <div className="mt-1 flex items-center gap-1">
                {STAR_VALUES.map((star) => (
                    <label
                        key={star}
                        className={`cursor-pointer rounded p-1 ${compact ? 'text-lg' : 'text-2xl'} text-amber-500 has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-teal-700 has-[:disabled]:cursor-not-allowed`}
                    >
                        <input
                            type="radio"
                            name={name}
                            value={star}
                            checked={value === star}
                            onChange={() => onChange(star)}
                            disabled={disabled}
                            className="sr-only"
                        />
                        <i
                            aria-hidden="true"
                            className={
                                value >= star
                                    ? 'fa-solid fa-star'
                                    : 'fa-regular fa-star'
                            }
                        ></i>
                        <span className="sr-only">
                            {star} {star === 1 ? 'star' : 'stars'}
                        </span>
                    </label>
                ))}
                <span className="ml-2 text-sm text-gray-700">
                    {value ? RATING_WORDS[value] : compact ? 'Not rated' : 'Choose 1 to 5 stars'}
                </span>
            </div>
        </fieldset>
    );
}
