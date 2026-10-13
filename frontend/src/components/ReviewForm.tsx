import { useState, type FormEvent } from 'react';
import { StarInput } from './Stars';
import { controlClass, primaryButtonClass, secondaryButtonClass } from './ui';

const MAX_COMMENT = 2000;

interface ReviewFormProps {
    idPrefix: string;
    initialRating?: number;
    initialComment?: string;
    submitLabel: string;
    busy: boolean;
    onSubmit: (rating: number, comment: string) => void;
    onCancel: () => void;
}

export function ReviewForm({
    idPrefix,
    initialRating = 0,
    initialComment = '',
    submitLabel,
    busy,
    onSubmit,
    onCancel,
}: ReviewFormProps) {
    const [rating, setRating] = useState(initialRating);
    const [comment, setComment] = useState(initialComment);
    const [error, setError] = useState('');

    function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (rating < 1) {
            setError('Choose a rating from 1 to 5 stars.');
            return;
        }
        setError('');
        onSubmit(rating, comment.trim());
    }

    return (
        <form
            onSubmit={submit}
            className="mt-4 rounded-xl border border-teal-100 bg-teal-50 p-4"
        >
            <StarInput
                name={`${idPrefix}-rating`}
                value={rating}
                onChange={(value) => {
                    setRating(value);
                    setError('');
                }}
                disabled={busy}
                describedBy={error ? `${idPrefix}-error` : undefined}
            />
            <label
                htmlFor={`${idPrefix}-comment`}
                className="mt-3 block font-semibold text-gray-900"
            >
                Comment <span className="font-normal text-gray-600">(optional)</span>
            </label>
            <textarea
                id={`${idPrefix}-comment`}
                value={comment}
                onChange={(event) => setComment(event.target.value)}
                maxLength={MAX_COMMENT}
                rows={3}
                disabled={busy}
                placeholder="What went well? What could be better?"
                className={`${controlClass} mt-1 w-full`}
            />
            <p className="m-0 text-right text-xs text-gray-600">
                {comment.length}/{MAX_COMMENT}
            </p>
            {error && (
                <p
                    id={`${idPrefix}-error`}
                    role="alert"
                    className="mb-0 mt-2 text-sm text-red-800"
                >
                    {error}
                </p>
            )}
            <div className="mt-3 flex flex-wrap gap-3">
                <button
                    type="submit"
                    disabled={busy}
                    className={primaryButtonClass}
                >
                    {busy ? 'Saving...' : submitLabel}
                </button>
                <button
                    type="button"
                    onClick={onCancel}
                    disabled={busy}
                    className={secondaryButtonClass}
                >
                    Cancel
                </button>
            </div>
        </form>
    );
}
