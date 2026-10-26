import { useState, type ChangeEvent, type FormEvent, type KeyboardEvent } from 'react';
import { MAX_PHOTOS, preparePhotos, type PickedPhoto } from '../photos';
import { photoUrl, type ReviewFields } from '../reviewApi';
import type { AspectKey, Aspects, CatalogItem, Pet, Review } from '../types';
import { StarInput } from './Stars';
import {
    ASPECT_LABELS,
    controlClass,
    formatPrice,
    primaryButtonClass,
    secondaryButtonClass,
    speciesLabel,
} from './ui';

const MAX_TITLE = 100;
const MAX_COMMENT = 2000;
const MAX_TAGS = 8;
const MAX_TAG_LENGTH = 30;
const SUGGESTED_TAGS = [
    'gentle',
    'clean',
    'on time',
    'good value',
    'friendly staff',
    'pet was calm',
];

type Recommend = 'yes' | 'no' | 'unsure';

export type ReviewFormValues = ReviewFields & {
    // Chosen in the form for a new review; null when editing.
    serviceId: number | null;
    petId: number | null;
    newPhotos: string[];
    removePhotoIds: string[];
};

interface ReviewFormProps {
    idPrefix: string;
    // Present when editing.
    review?: Review;
    // A new review starts by choosing one of these services.
    services?: CatalogItem[];
    // Starts the form on this service, e.g. from a service's own Review button.
    initialServiceId?: number;
    // The owner's pets; the form offers those the chosen service supports.
    pets?: Pet[];
    busy: boolean;
    // An error from saving, shown with the form's own errors.
    error: string;
    onSubmit: (values: ReviewFormValues) => void;
    onCancel: () => void;
}

// A calendar date in the reader's time zone, as YYYY-MM-DD.
function localDate(offsetDays = 0): string {
    const date = new Date();
    date.setDate(date.getDate() + offsetDays);
    const pad = (value: number) => String(value).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

const chipClass =
    'min-h-9 rounded-full border px-3 py-1 text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 disabled:cursor-not-allowed disabled:opacity-50';

export function ReviewForm({
    idPrefix,
    review,
    services = [],
    initialServiceId,
    pets = [],
    busy,
    error,
    onSubmit,
    onCancel,
}: ReviewFormProps) {
    const id = (name: string) => `${idPrefix}-${name}`;
    const [serviceId, setServiceId] = useState(
        initialServiceId ? String(initialServiceId) : '',
    );
    // null until the owner picks; until then the first eligible pet is used,
    // which also covers pets that finish loading after a service is chosen.
    const [petChoice, setPetChoice] = useState<string | null>(null);
    const [rating, setRating] = useState(review?.rating ?? 0);
    const [aspects, setAspects] = useState<Aspects>(review?.aspects ?? {});
    const [title, setTitle] = useState(review?.title ?? '');
    const [comment, setComment] = useState(review?.comment ?? '');
    // A new review is usually written right after the visit.
    const [visitedOn, setVisitedOn] = useState(
        review ? (review.visitedOn ?? '') : localDate(),
    );
    const [tags, setTags] = useState<string[]>(review?.tags ?? []);
    const [tagDraft, setTagDraft] = useState('');
    const [recommend, setRecommend] = useState<Recommend>(
        review?.wouldRecommend === true
            ? 'yes'
            : review?.wouldRecommend === false
              ? 'no'
              : 'unsure',
    );
    const [removedPhotoIds, setRemovedPhotoIds] = useState<string[]>([]);
    const [newPhotos, setNewPhotos] = useState<PickedPhoto[]>([]);
    const [preparing, setPreparing] = useState(false);
    const [photoMessage, setPhotoMessage] = useState('');
    const [formError, setFormError] = useState('');
    // Visits within the last two years, up to today.
    const [dates] = useState(() => ({ min: localDate(-729), max: localDate() }));

    const service = services.find((item) => item.id === Number(serviceId));
    const eligiblePets = service
        ? pets.filter((pet) => service.species.includes(pet.species))
        : [];
    const petId = petChoice ?? String(eligiblePets[0]?.id ?? '');
    const categories = [...new Set(services.map((item) => item.category))].sort();

    const keptPhotos = (review?.photos ?? []).filter(
        (photo) => !removedPhotoIds.includes(photo.id),
    );
    const freeSlots = MAX_PHOTOS - keptPhotos.length - newPhotos.length;
    const disabled = busy || preparing;
    const customTags = tags.filter((tag) => !SUGGESTED_TAGS.includes(tag));
    const shownError = formError || error;

    function cleanTag(raw: string): string {
        return raw.trim().toLowerCase().replace(/\s+/g, ' ');
    }

    function toggleTag(tag: string) {
        setTags((current) =>
            current.includes(tag)
                ? current.filter((item) => item !== tag)
                : current.length >= MAX_TAGS
                  ? current
                  : [...current, tag],
        );
    }

    function addDraftTag(): string[] | null {
        const tag = cleanTag(tagDraft);
        if (!tag) return tags;
        if (tag.length > MAX_TAG_LENGTH) {
            setFormError(`Each tag can be at most ${MAX_TAG_LENGTH} characters.`);
            return null;
        }
        if (!tags.includes(tag) && tags.length >= MAX_TAGS) {
            setFormError(`Use at most ${MAX_TAGS} tags.`);
            return null;
        }
        const next = tags.includes(tag) ? tags : [...tags, tag];
        setTags(next);
        setTagDraft('');
        setFormError('');
        return next;
    }

    function onTagKey(event: KeyboardEvent<HTMLInputElement>) {
        if (event.key === 'Enter' || event.key === ',') {
            event.preventDefault();
            addDraftTag();
        }
    }

    function setAspect(key: AspectKey, value: number | null) {
        setAspects((current) => {
            const next = { ...current };
            if (value === null) delete next[key];
            else next[key] = value;
            return next;
        });
    }

    async function pickPhotos(event: ChangeEvent<HTMLInputElement>) {
        const files = Array.from(event.target.files ?? []);
        // Allow picking the same file again after removing it.
        event.target.value = '';
        if (files.length === 0) return;
        const accepted = files.slice(0, Math.max(0, freeSlots));
        setPreparing(true);
        setPhotoMessage('');
        const { photos, error: readError } = await preparePhotos(accepted);
        setNewPhotos((current) => [...current, ...photos]);
        const left = files.length - accepted.length;
        setPhotoMessage(
            [
                readError,
                left > 0
                    ? `A review can have ${MAX_PHOTOS} photos, so ${left} ${left === 1 ? 'was' : 'were'} left out.`
                    : '',
            ]
                .filter(Boolean)
                .join(' '),
        );
        setPreparing(false);
    }

    function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (!review && !service) {
            setFormError('Choose the service you used.');
            return;
        }
        if (rating < 1) {
            setFormError('Choose an overall rating from 1 to 5 stars.');
            return;
        }
        if (visitedOn && (visitedOn < dates.min || visitedOn > dates.max)) {
            setFormError('Choose a visit date within the last two years.');
            return;
        }
        // Include a tag that was typed but not added yet.
        const finalTags = addDraftTag();
        if (finalTags === null) return;
        setFormError('');
        onSubmit({
            serviceId: service?.id ?? null,
            petId: petId ? Number(petId) : null,
            rating,
            aspects: Object.keys(aspects).length > 0 ? aspects : null,
            title: title.trim(),
            comment: comment.trim(),
            visitedOn: visitedOn || null,
            tags: finalTags,
            wouldRecommend: recommend === 'unsure' ? null : recommend === 'yes',
            newPhotos: newPhotos.map((photo) => photo.dataUrl),
            removePhotoIds: removedPhotoIds,
        });
    }

    return (
        <form onSubmit={submit} noValidate className="space-y-5">
            {!review && (
                <div>
                    <label htmlFor={id('service')} className="block font-semibold text-gray-900">
                        Which service did you use?
                    </label>
                    <select
                        id={id('service')}
                        value={serviceId}
                        onChange={(event) => {
                            setServiceId(event.target.value);
                            setPetChoice(null);
                            setFormError('');
                        }}
                        disabled={disabled}
                        required
                        aria-describedby={service ? id('service-info') : undefined}
                        className={`${controlClass} mt-1 w-full`}
                    >
                        <option value="">Choose a service</option>
                        {categories.map((category) => (
                            <optgroup key={category} label={category}>
                                {services
                                    .filter((item) => item.category === category)
                                    .map((item) => (
                                        <option key={item.id} value={item.id}>
                                            {item.title} · {item.provider}
                                        </option>
                                    ))}
                            </optgroup>
                        ))}
                    </select>
                    {service && (
                        <p id={id('service-info')} className="mb-0 mt-1 text-sm text-gray-600">
                            {speciesLabel(service.species)} · {formatPrice(service.price)}
                        </p>
                    )}
                </div>
            )}

            {!review && eligiblePets.length > 0 && (
                <div>
                    <label htmlFor={id('pet')} className="block font-semibold text-gray-900">
                        Which pet went?
                    </label>
                    <select
                        id={id('pet')}
                        value={petId}
                        onChange={(event) => setPetChoice(event.target.value)}
                        disabled={disabled}
                        className={`${controlClass} mt-1 w-full sm:max-w-xs`}
                    >
                        {eligiblePets.map((pet) => (
                            <option key={pet.id} value={pet.id}>
                                {pet.name} · {pet.species}
                            </option>
                        ))}
                        <option value="">Not about a specific pet</option>
                    </select>
                </div>
            )}

            <StarInput
                name={id('rating')}
                label="Overall rating"
                value={rating}
                onChange={(value) => {
                    setRating(value);
                    setFormError('');
                }}
                disabled={disabled}
                describedBy={shownError ? id('error') : undefined}
            />

            <fieldset className="m-0 rounded-xl border border-gray-200 p-4">
                <legend className="px-1 font-semibold text-gray-900">
                    Rate the details{' '}
                    <span className="font-normal text-gray-600">(optional)</span>
                </legend>
                <div className="grid gap-4 sm:grid-cols-2">
                    {(Object.keys(ASPECT_LABELS) as AspectKey[]).map((key) => (
                        <div key={key} className="flex items-end justify-between gap-2">
                            <StarInput
                                name={id(`aspect-${key}`)}
                                label={ASPECT_LABELS[key]}
                                value={aspects[key] ?? 0}
                                onChange={(value) => setAspect(key, value)}
                                disabled={disabled}
                                compact
                            />
                            {aspects[key] !== undefined && (
                                <button
                                    type="button"
                                    onClick={() => setAspect(key, null)}
                                    disabled={disabled}
                                    aria-label={`Clear ${ASPECT_LABELS[key]} rating`}
                                    className="min-h-9 rounded-md px-2 text-sm text-gray-600 underline hover:text-gray-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-700"
                                >
                                    Clear
                                </button>
                            )}
                        </div>
                    ))}
                </div>
            </fieldset>

            <div>
                <label htmlFor={id('title')} className="block font-semibold text-gray-900">
                    Headline <span className="font-normal text-gray-600">(optional)</span>
                </label>
                <input
                    id={id('title')}
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    maxLength={MAX_TITLE}
                    disabled={disabled}
                    placeholder="e.g. Gentle with a nervous dog"
                    className={`${controlClass} mt-1 w-full`}
                />
            </div>

            <div>
                <label htmlFor={id('comment')} className="block font-semibold text-gray-900">
                    Your experience <span className="font-normal text-gray-600">(optional)</span>
                </label>
                <textarea
                    id={id('comment')}
                    value={comment}
                    onChange={(event) => setComment(event.target.value)}
                    maxLength={MAX_COMMENT}
                    rows={4}
                    disabled={disabled}
                    placeholder="What went well? What could be better?"
                    className={`${controlClass} mt-1 w-full`}
                />
                <p className="m-0 text-right text-xs text-gray-600">
                    {comment.length}/{MAX_COMMENT}
                </p>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
                <div>
                    <label htmlFor={id('visited')} className="block font-semibold text-gray-900">
                        Date of visit <span className="font-normal text-gray-600">(optional)</span>
                    </label>
                    <input
                        id={id('visited')}
                        type="date"
                        value={visitedOn}
                        min={dates.min}
                        max={dates.max}
                        onChange={(event) => setVisitedOn(event.target.value)}
                        disabled={disabled}
                        className={`${controlClass} mt-1 w-full`}
                    />
                </div>

                <fieldset className="m-0 border-0 p-0">
                    <legend className="font-semibold text-gray-900">
                        Would you recommend it?
                    </legend>
                    <div className="mt-1 flex flex-wrap gap-2">
                        {(
                            [
                                ['yes', 'Yes'],
                                ['no', 'No'],
                                ['unsure', 'Not sure'],
                            ] as const
                        ).map(([value, label]) => (
                            <label
                                key={value}
                                className="flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 has-[:checked]:border-teal-700 has-[:checked]:bg-teal-50 has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-teal-700"
                            >
                                <input
                                    type="radio"
                                    name={id('recommend')}
                                    value={value}
                                    checked={recommend === value}
                                    onChange={() => setRecommend(value)}
                                    disabled={disabled}
                                    className="accent-teal-700"
                                />
                                {label}
                            </label>
                        ))}
                    </div>
                </fieldset>
            </div>

            <fieldset className="m-0 border-0 p-0">
                <legend className="font-semibold text-gray-900">
                    Tags <span className="font-normal text-gray-600">(optional, up to {MAX_TAGS})</span>
                </legend>
                <div className="mt-1 flex flex-wrap gap-2">
                    {SUGGESTED_TAGS.map((tag) => {
                        const on = tags.includes(tag);
                        return (
                            <button
                                key={tag}
                                type="button"
                                aria-pressed={on}
                                onClick={() => toggleTag(tag)}
                                disabled={disabled || (!on && tags.length >= MAX_TAGS)}
                                className={`${chipClass} ${on ? 'border-teal-700 bg-teal-700 text-white' : 'border-gray-300 bg-white text-gray-800 hover:bg-gray-50'}`}
                            >
                                {on && <i aria-hidden="true" className="fa-solid fa-check mr-1"></i>}
                                {tag}
                            </button>
                        );
                    })}
                    {customTags.map((tag) => (
                        <button
                            key={tag}
                            type="button"
                            onClick={() => toggleTag(tag)}
                            disabled={disabled}
                            aria-label={`Remove tag ${tag}`}
                            className={`${chipClass} border-teal-700 bg-teal-700 text-white`}
                        >
                            {tag}
                            <i aria-hidden="true" className="fa-solid fa-xmark ml-2"></i>
                        </button>
                    ))}
                </div>
                <div className="mt-2 flex gap-2">
                    <label htmlFor={id('tag')} className="sr-only">
                        Add your own tag
                    </label>
                    <input
                        id={id('tag')}
                        value={tagDraft}
                        onChange={(event) => setTagDraft(event.target.value)}
                        onKeyDown={onTagKey}
                        maxLength={MAX_TAG_LENGTH}
                        disabled={disabled || tags.length >= MAX_TAGS}
                        placeholder="Add your own tag"
                        className={`${controlClass} w-full sm:max-w-xs`}
                    />
                    <button
                        type="button"
                        onClick={addDraftTag}
                        disabled={disabled || !tagDraft.trim() || tags.length >= MAX_TAGS}
                        className={secondaryButtonClass}
                    >
                        Add
                    </button>
                </div>
            </fieldset>

            <fieldset className="m-0 border-0 p-0" aria-describedby={id('photo-help')}>
                <legend className="font-semibold text-gray-900">
                    Photos <span className="font-normal text-gray-600">(optional, up to {MAX_PHOTOS})</span>
                </legend>
                <p id={id('photo-help')} className="mb-2 mt-1 text-sm text-gray-600">
                    Photos are resized and their location data is removed before
                    they are saved.
                </p>
                {(keptPhotos.length > 0 || newPhotos.length > 0) && (
                    <ul className="m-0 mb-3 grid list-none grid-cols-2 gap-3 p-0 sm:grid-cols-4">
                        {keptPhotos.map((photo, index) => (
                            <li key={photo.id} className="relative">
                                <img
                                    src={photoUrl(photo.id)}
                                    width={photo.width}
                                    height={photo.height}
                                    alt={`Saved photo ${index + 1}`}
                                    className="aspect-square h-auto w-full rounded-lg object-cover"
                                />
                                <button
                                    type="button"
                                    onClick={() =>
                                        setRemovedPhotoIds((current) => [...current, photo.id])
                                    }
                                    disabled={disabled}
                                    aria-label={`Remove saved photo ${index + 1}`}
                                    className="absolute right-1 top-1 min-h-9 min-w-9 rounded-full border-0 bg-black/70 text-snow hover:bg-black focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
                                >
                                    <i aria-hidden="true" className="fa-solid fa-xmark"></i>
                                </button>
                            </li>
                        ))}
                        {newPhotos.map((photo, index) => (
                            <li key={photo.key} className="relative">
                                <img
                                    src={photo.dataUrl}
                                    alt={`New photo ${index + 1}`}
                                    className="aspect-square h-auto w-full rounded-lg object-cover"
                                />
                                <button
                                    type="button"
                                    onClick={() =>
                                        setNewPhotos((current) =>
                                            current.filter((item) => item.key !== photo.key),
                                        )
                                    }
                                    disabled={disabled}
                                    aria-label={`Remove new photo ${index + 1}`}
                                    className="absolute right-1 top-1 min-h-9 min-w-9 rounded-full border-0 bg-black/70 text-snow hover:bg-black focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
                                >
                                    <i aria-hidden="true" className="fa-solid fa-xmark"></i>
                                </button>
                            </li>
                        ))}
                    </ul>
                )}
                {removedPhotoIds.length > 0 && (
                    <p className="mb-2 mt-0 text-sm text-gray-700">
                        {removedPhotoIds.length} saved{' '}
                        {removedPhotoIds.length === 1 ? 'photo' : 'photos'} will be
                        removed when you save.{' '}
                        <button
                            type="button"
                            onClick={() => setRemovedPhotoIds([])}
                            disabled={disabled}
                            className="rounded font-semibold text-teal-800 underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-700"
                        >
                            Undo
                        </button>
                    </p>
                )}
                {freeSlots > 0 && (
                    <label
                        className={`${secondaryButtonClass} inline-flex cursor-pointer items-center gap-2 has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-50 has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-teal-700`}
                    >
                        <i aria-hidden="true" className="fa-solid fa-camera"></i>
                        {preparing ? 'Preparing photos...' : 'Add photos'}
                        <input
                            type="file"
                            accept="image/jpeg,image/png,image/webp"
                            multiple
                            onChange={pickPhotos}
                            disabled={disabled}
                            className="sr-only"
                        />
                    </label>
                )}
                {photoMessage && (
                    <p role="alert" className="mb-0 mt-2 text-sm text-amber-900">
                        {photoMessage}
                    </p>
                )}
            </fieldset>

            {shownError && (
                <p
                    id={id('error')}
                    role="alert"
                    className="m-0 rounded-lg bg-red-50 p-3 text-sm text-red-800"
                >
                    {shownError}
                </p>
            )}
            <div className="flex flex-wrap justify-end gap-3">
                <button
                    type="button"
                    onClick={onCancel}
                    disabled={busy}
                    className={secondaryButtonClass}
                >
                    Cancel
                </button>
                <button type="submit" disabled={disabled} className={primaryButtonClass}>
                    {busy ? 'Saving...' : review ? 'Save changes' : 'Post review'}
                </button>
            </div>
        </form>
    );
}
