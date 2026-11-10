import { useState, useEffect } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router';
import type { CatalogItem, Pet, User } from '../types';
import { EmptyState } from '../components/EmptyState';
import {
    controlClass,
    dangerButtonClass,
    dangerTextButtonClass,
    formatPrice,
    primaryButtonClass,
    secondaryButtonClass,
    speciesIcon,
} from '../components/ui';
import { HOME_PATH } from '../routes';

interface ProfilePageProps {
    currentUser: User | null;
    onUserUpdated: (user: User) => void;
}

interface PetForm {
    name: string;
    species: string;
    needs: string[];
    maxPrice: string;
}

// New pets start with a ฿2,000 budget; 0 or an empty field means no limit.
const EMPTY_FORM: PetForm = { name: '', species: 'dog', needs: [], maxPrice: '2000' };

function readableTag(tag: string): string {
    const text = tag.replaceAll('-', ' ');
    return text.charAt(0).toUpperCase() + text.slice(1);
}

function capitalize(text: string): string {
    return text.charAt(0).toUpperCase() + text.slice(1);
}

async function errorMessage(response: Response, fallback: string): Promise<string> {
    const data = await response.json().catch(() => null);
    const message = data?.message;
    return Array.isArray(message) ? message.join(' ') : typeof message === 'string' ? message : fallback;
}

export function ProfilePage({ currentUser, onUserUpdated }: ProfilePageProps) {
    return (
        <main className="max-w-3xl space-y-8">
            <h2 className="m-0 text-2xl font-bold text-gray-900">My profile</h2>
            <AccountSection currentUser={currentUser} onUserUpdated={onUserUpdated} />
            <PetsSection currentUser={currentUser} />
        </main>
    );
}

// ---------- Account ----------

function AccountSection({ currentUser, onUserUpdated }: ProfilePageProps) {
    const [editing, setEditing] = useState(false);
    const [form, setForm] = useState({ firstname: '', lastname: '', email: '' });
    const [errors, setErrors] = useState<{ firstname?: string; lastname?: string; email?: string }>({});
    const [formError, setFormError] = useState('');
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState('');

    function startEditing() {
        setForm({
            firstname: currentUser?.firstname ?? '',
            lastname: currentUser?.lastname ?? '',
            email: currentUser?.email ?? '',
        });
        setErrors({});
        setFormError('');
        setMessage('');
        setEditing(true);
    }

    async function save(event: FormEvent) {
        event.preventDefault();
        if (!currentUser?.id) return;
        const next = {
            firstname: form.firstname.trim(),
            lastname: form.lastname.trim(),
            email: form.email.trim(),
        };
        const found: typeof errors = {};
        if (!next.firstname) found.firstname = 'Enter your first name.';
        if (!next.lastname) found.lastname = 'Enter your last name.';
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(next.email)) found.email = 'Enter an email like name@example.com.';
        setErrors(found);
        setFormError('');
        if (Object.keys(found).length > 0) return;

        setBusy(true);
        try {
            const response = await fetch(`/api/users/${currentUser.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(next),
            });
            if (response.status === 409) {
                setErrors({ email: await errorMessage(response, 'This email is already used by another account.') });
                return;
            }
            if (!response.ok) {
                setFormError(await errorMessage(response, 'Could not save your details. Please try again.'));
                return;
            }
            const user = (await response.json()) as User;
            onUserUpdated(user);
            setEditing(false);
            setMessage('Your details are saved.');
        } catch {
            setFormError('Could not reach Pawpal. Check your connection and try again.');
        } finally {
            setBusy(false);
        }
    }

    const field = (
        name: 'firstname' | 'lastname' | 'email',
        label: string,
        props: { type?: string; autoComplete: string; className?: string; hint?: string },
    ) => (
        <div className={props.className}>
            <label htmlFor={`account-${name}`} className="block text-sm font-semibold text-gray-900">{label}</label>
            <input
                id={`account-${name}`}
                type={props.type ?? 'text'}
                autoComplete={props.autoComplete}
                value={form[name]}
                onChange={(event) => {
                    setForm({ ...form, [name]: event.target.value });
                    setErrors({ ...errors, [name]: undefined });
                }}
                disabled={busy}
                aria-invalid={Boolean(errors[name])}
                aria-describedby={[errors[name] && `account-${name}-error`, props.hint && `account-${name}-hint`].filter(Boolean).join(' ') || undefined}
                className={`${controlClass} mt-1 w-full ${errors[name] ? 'border-red-700' : ''}`}
            />
            {props.hint && !errors[name] && (
                <p id={`account-${name}-hint`} className="mb-0 mt-1 text-sm text-gray-600">{props.hint}</p>
            )}
            {errors[name] && (
                <p id={`account-${name}-error`} className="mb-0 mt-1 text-sm text-red-700">{errors[name]}</p>
            )}
        </div>
    );

    return (
        <section aria-labelledby="account-title" className="rounded-2xl border border-gray-200 bg-white p-5 sm:p-6">
            <div className="mb-4 flex items-center justify-between gap-3">
                <h3 id="account-title" className="m-0 text-lg font-bold text-gray-900">Account</h3>
                {editing ? (
                    <span className="rounded-full bg-sun px-3 py-0.5 text-sm font-semibold text-sun-ink">Editing</span>
                ) : (
                    <button type="button" onClick={startEditing} className={`${secondaryButtonClass} inline-flex items-center`}>
                        <i aria-hidden="true" className="fa-solid fa-pen mr-2 text-sm"></i>
                        Edit details
                    </button>
                )}
            </div>

            {editing ? (
                <form onSubmit={save} noValidate className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    {field('firstname', 'First name', { autoComplete: 'given-name' })}
                    {field('lastname', 'Last name', { autoComplete: 'family-name' })}
                    {field('email', 'Email', {
                        type: 'email',
                        autoComplete: 'email',
                        className: 'sm:col-span-2',
                        hint: 'You log in with this email.',
                    })}
                    {formError && (
                        <p role="alert" className="m-0 rounded-lg bg-red-50 p-3 text-sm text-red-800 sm:col-span-2">{formError}</p>
                    )}
                    <div className="flex justify-end gap-2 sm:col-span-2">
                        <button type="button" onClick={() => setEditing(false)} disabled={busy} className={secondaryButtonClass}>
                            Cancel
                        </button>
                        <button type="submit" disabled={busy} className={primaryButtonClass}>
                            {busy ? 'Saving…' : 'Save changes'}
                        </button>
                    </div>
                </form>
            ) : (
                <dl className="m-0 grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                        <dt className="text-sm font-semibold text-gray-600">Name</dt>
                        <dd className="m-0 mt-0.5 text-gray-900">{currentUser?.firstname} {currentUser?.lastname}</dd>
                    </div>
                    <div>
                        <dt className="text-sm font-semibold text-gray-600">Email</dt>
                        <dd className="m-0 mt-0.5 break-all text-gray-900">{currentUser?.email}</dd>
                    </div>
                </dl>
            )}
            {message && !editing && (
                <p role="status" className="mb-0 mt-4 rounded-lg bg-green-50 p-3 text-sm text-green-900">
                    <i aria-hidden="true" className="fa-solid fa-circle-check mr-2"></i>
                    {message}
                </p>
            )}
        </section>
    );
}

// ---------- Pets ----------

function PetsSection({ currentUser }: { currentUser: User | null }) {
    const [loading, setLoading] = useState<boolean>(Boolean(currentUser?.id));
    const [loadError, setLoadError] = useState('');
    const [retry, setRetry] = useState(0);
    const [pets, setPets] = useState<Pet[]>([]);

    // null = form hidden, 'new' = creating, number = editing that pet id
    const [editingId, setEditingId] = useState<number | 'new' | null>(null);
    const [form, setForm] = useState<PetForm>(EMPTY_FORM);
    const [error, setError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [catalog, setCatalog] = useState<CatalogItem[]>([]);
    const [confirmDelete, setConfirmDelete] = useState<number | null>(null);
    const [deleting, setDeleting] = useState<number | null>(null);
    const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);

    useEffect(() => {
        const controller = new AbortController();
        fetch('/api/catalog', { signal: controller.signal })
            .then((response) => (response.ok ? response.json() : []))
            .then((data: CatalogItem[]) => setCatalog(data))
            .catch((error: unknown) => {
                if (!controller.signal.aborted) console.error('Error fetching catalog:', error);
            });
        return () => controller.abort();
    }, []);

    useEffect(() => {
        if (!currentUser?.id) return;
        const controller = new AbortController();
        fetch(`/api/pet-profile/me?userId=${currentUser.id}`, { signal: controller.signal })
            .then((response) => {
                if (!response.ok) throw new Error('Could not load your pets.');
                return response.json() as Promise<Pet[]>;
            })
            .then(setPets)
            .catch((error: unknown) => {
                if (!controller.signal.aborted) {
                    setLoadError(error instanceof Error ? error.message : 'Could not load your pets.');
                }
            })
            .finally(() => {
                if (!controller.signal.aborted) setLoading(false);
            });
        return () => controller.abort();
    }, [currentUser?.id, retry]);

    // Only tags that some service for this species offers can ever match a recommendation.
    const tagsForSpecies = (species: string) =>
        [...new Set(
            catalog
                .filter((item) => item.species.includes(species))
                .flatMap((item) => item.tags),
        )].sort();

    const speciesTags = tagsForSpecies(form.species);
    // Needs saved before this picker existed may not be valid tags; show them so they can be unchecked.
    const legacyNeeds = form.needs.filter((need) => !speciesTags.includes(need));

    const toggleNeed = (tag: string) => {
        setForm((prev) => ({
            ...prev,
            needs: prev.needs.includes(tag)
                ? prev.needs.filter((need) => need !== tag)
                : [...prev.needs, tag],
        }));
    };

    const changeSpecies = (species: string) => {
        const allowed = tagsForSpecies(species);
        setForm((prev) => ({
            ...prev,
            species,
            needs: prev.needs.filter((need) => allowed.includes(need)),
        }));
    };

    const openCreateForm = () => {
        setForm(EMPTY_FORM);
        setError(null);
        setMessage(null);
        setConfirmDelete(null);
        setEditingId('new');
    };

    const openEditForm = (pet: Pet) => {
        setForm({
            name: pet.name,
            species: pet.species,
            needs: pet.needs,
            maxPrice: pet.maxPrice ? String(pet.maxPrice) : '',
        });
        setError(null);
        setMessage(null);
        setConfirmDelete(null);
        setEditingId(pet.id);
    };

    const closeForm = () => {
        setEditingId(null);
        setError(null);
    };

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        if (!currentUser?.id || editingId === null) return;
        if (!form.name.trim()) {
            setError('Enter your pet’s name.');
            return;
        }

        const payload = {
            userId: currentUser.id,
            name: form.name.trim(),
            species: form.species.trim(),
            needs: form.needs,
            maxPrice: Number(form.maxPrice || 0),
        };

        const isNew = editingId === 'new';
        setSaving(true);
        setError(null);

        try {
            const response = await fetch(
                isNew ? '/api/pet-profile' : `/api/pet-profile/${editingId}`,
                {
                    method: isNew ? 'POST' : 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                },
            );

            if (!response.ok) {
                setError(await errorMessage(response, 'Could not save this pet. Please try again.'));
                return;
            }
            const data = (await response.json()) as Pet;

            setPets((prev) => isNew
                ? [...prev, data]
                : prev.map((p) => (p.id === data.id ? data : p)));
            closeForm();
            setMessage({ text: isNew ? `${data.name} is added.` : `${data.name} is updated.`, error: false });
        } catch {
            setError('Could not reach Pawpal. Check your connection and try again.');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (pet: Pet) => {
        if (!currentUser?.id) return;
        setDeleting(pet.id);
        setMessage(null);

        try {
            const response = await fetch(`/api/pet-profile/${pet.id}?userId=${currentUser.id}`, {
                method: 'DELETE'
            });
            if (!response.ok) throw new Error();
            setPets((prev) => prev.filter((p) => p.id !== pet.id));
            setConfirmDelete(null);
            if (editingId === pet.id) closeForm();
            setMessage({ text: `${pet.name} was deleted.`, error: false });
        } catch {
            setMessage({ text: `Could not delete ${pet.name}. Please try again.`, error: true });
        } finally {
            setDeleting(null);
        }
    };

    const petForm = (
        <form
            onSubmit={handleSubmit}
            noValidate
            aria-label={editingId === 'new' ? 'Add a pet' : 'Edit pet'}
            className="space-y-4 rounded-2xl border border-teal-200 bg-white p-5"
        >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                    <label htmlFor="pet-name" className="block text-sm font-semibold text-gray-900">Name</label>
                    <input
                        id="pet-name"
                        required
                        value={form.name}
                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                        disabled={saving}
                        placeholder="e.g. Mochi"
                        className={`${controlClass} mt-1 w-full`}
                    />
                </div>
                <div>
                    <label htmlFor="pet-species" className="block text-sm font-semibold text-gray-900">Species</label>
                    <select
                        id="pet-species"
                        value={form.species}
                        onChange={(e) => changeSpecies(e.target.value)}
                        disabled={saving}
                        className={`${controlClass} mt-1 w-full`}
                    >
                        <option value="dog">Dog</option>
                        <option value="cat">Cat</option>
                    </select>
                </div>
                <fieldset className="m-0 min-w-0 border-0 p-0 sm:col-span-2">
                    <legend className="p-0 text-sm font-semibold text-gray-900">Care needs</legend>
                    <div className="mt-2 flex flex-wrap gap-2">
                        {[...speciesTags, ...legacyNeeds].map((tag) => {
                            const checked = form.needs.includes(tag);
                            const isLegacy = legacyNeeds.includes(tag);
                            return (
                                <label
                                    key={tag}
                                    title={isLegacy ? 'No services match this need — uncheck to remove it' : undefined}
                                    className={`inline-flex min-h-9 cursor-pointer select-none items-center gap-2 rounded-full border px-3 py-1.5 text-sm has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-teal-700 ${isLegacy
                                        ? 'border-amber-300 bg-amber-50 text-amber-900 line-through'
                                        : checked
                                            ? 'border-teal-700 bg-teal-700 text-white'
                                            : 'border-gray-300 bg-white text-gray-700 hover:border-teal-500'
                                        }`}
                                >
                                    <input
                                        type="checkbox"
                                        checked={checked}
                                        onChange={() => toggleNeed(tag)}
                                        className="sr-only"
                                    />
                                    {checked && !isLegacy && <i className="fa-solid fa-check text-xs" aria-hidden="true"></i>}
                                    {readableTag(tag)}
                                </label>
                            );
                        })}
                        {catalog.length === 0 && (
                            <span className="text-sm text-gray-600">Loading options…</span>
                        )}
                    </div>
                    {legacyNeeds.length > 0 && (
                        <p className="mb-0 mt-2 text-sm text-amber-900">
                            Crossed-out needs don't match any service. Uncheck them and pick from the list instead.
                        </p>
                    )}
                </fieldset>
                <div>
                    <label htmlFor="pet-budget" className="block text-sm font-semibold text-gray-900">Budget per visit (฿)</label>
                    <input
                        id="pet-budget"
                        type="number"
                        inputMode="numeric"
                        min="0"
                        step="50"
                        value={form.maxPrice}
                        onChange={(e) => setForm({ ...form, maxPrice: e.target.value })}
                        disabled={saving}
                        placeholder="Leave empty for any budget"
                        aria-describedby="pet-budget-hint"
                        className={`${controlClass} mt-1 w-full`}
                    />
                    <p id="pet-budget-hint" className="mb-0 mt-1 text-sm text-gray-600">Leave empty for any budget.</p>
                </div>
            </div>

            {error && <p role="alert" className="m-0 rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>}

            <div className="flex justify-end gap-2">
                <button type="button" onClick={closeForm} disabled={saving} className={secondaryButtonClass}>
                    Cancel
                </button>
                <button type="submit" disabled={saving} className={primaryButtonClass}>
                    {saving ? 'Saving…' : editingId === 'new' ? 'Add pet' : 'Save changes'}
                </button>
            </div>
        </form>
    );

    return (
        <section aria-labelledby="pets-title" className="space-y-3">
            <div className="flex items-center justify-between gap-3">
                <h3 id="pets-title" className="m-0 text-lg font-bold text-gray-900">My pets</h3>
                {editingId === null && !loading && !loadError && (
                    <button type="button" onClick={openCreateForm} className={`${primaryButtonClass} inline-flex items-center`}>
                        <i aria-hidden="true" className="fa-solid fa-plus mr-2"></i>
                        Add pet
                    </button>
                )}
            </div>

            {message && (
                <p
                    role={message.error ? 'alert' : 'status'}
                    className={`m-0 rounded-lg p-3 text-sm ${message.error ? 'bg-red-50 text-red-800' : 'bg-green-50 text-green-900'}`}
                >
                    {message.text}
                </p>
            )}

            {loading && <p role="status" className="text-gray-600">Loading your pets…</p>}

            {loadError && (
                <div role="alert" className="rounded-lg bg-red-50 p-4 text-red-800">
                    <p className="m-0">{loadError}</p>
                    <button
                        type="button"
                        onClick={() => {
                            setLoadError('');
                            setLoading(true);
                            setRetry((count) => count + 1);
                        }}
                        className={`${secondaryButtonClass} mt-3`}
                    >
                        Try again
                    </button>
                </div>
            )}

            {editingId === 'new' && petForm}

            {!loading && !loadError && pets.length === 0 && editingId !== 'new' && (
                <EmptyState
                    icon="fa-paw"
                    title="Add your first pet"
                    body="Tell us your pet’s species, care needs and budget, and we’ll find services that fit."
                    action={
                        <button type="button" onClick={openCreateForm} className={`${primaryButtonClass} inline-flex items-center`}>
                            <i aria-hidden="true" className="fa-solid fa-plus mr-2"></i>
                            Add a pet
                        </button>
                    }
                />
            )}

            <ul className="m-0 list-none space-y-3 p-0">
                {pets.map((pet) => (
                    editingId === pet.id ? (
                        <li key={pet.id}>{petForm}</li>
                    ) : (
                        <li
                            key={pet.id}
                            className={`rounded-2xl border bg-white p-4 ${confirmDelete === pet.id ? 'border-red-200' : 'border-gray-200'}`}
                        >
                            <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
                                <div className="min-w-0 flex-[1_1_18rem] space-y-1.5">
                                    <div className="flex items-center gap-2">
                                        <i aria-hidden="true" className={`fa-solid ${speciesIcon(pet.species)} text-teal-500`}></i>
                                        <strong className="text-lg text-gray-900">{pet.name}</strong>
                                        <span className="rounded-md bg-blue-100 px-2 py-0.5 text-sm font-semibold text-blue-900">
                                            {capitalize(pet.species)}
                                        </span>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-1.5 text-sm">
                                        {pet.needs.length > 0 ? pet.needs.map((need) => (
                                            <span key={need} className="rounded-full bg-teal-50 px-2.5 py-0.5 text-gray-900">
                                                {readableTag(need)}
                                            </span>
                                        )) : <span className="text-gray-600">No care needs yet</span>}
                                        <span className="px-1 text-gray-600">
                                            · {pet.maxPrice > 0 ? `Budget ${formatPrice(pet.maxPrice)}` : 'Any budget'}
                                        </span>
                                    </div>
                                </div>
                                {confirmDelete !== pet.id && (
                                    <div className="flex flex-wrap gap-2">
                                        <Link
                                            to={`${HOME_PATH}?pet=${pet.id}`}
                                            className="inline-flex min-h-11 items-center rounded-lg bg-teal-50 px-3 text-sm font-semibold text-teal-800 no-underline hover:bg-teal-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
                                        >
                                            Find care
                                            <span className="sr-only"> for {pet.name}</span>
                                        </Link>
                                        <button
                                            type="button"
                                            onClick={() => openEditForm(pet)}
                                            className={`${secondaryButtonClass} px-3 text-sm`}
                                        >
                                            Edit
                                            <span className="sr-only"> {pet.name}</span>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setConfirmDelete(pet.id);
                                                setMessage(null);
                                            }}
                                            className={`${dangerTextButtonClass} px-3 text-sm`}
                                        >
                                            Delete
                                            <span className="sr-only"> {pet.name}</span>
                                        </button>
                                    </div>
                                )}
                            </div>

                            {confirmDelete === pet.id && (
                                <div
                                    role="group"
                                    aria-labelledby={`delete-${pet.id}-title`}
                                    className="mt-3 rounded-xl border border-red-200 bg-red-50 p-4"
                                >
                                    <p id={`delete-${pet.id}-title`} className="m-0 font-semibold text-gray-900">
                                        Delete {pet.name}?
                                    </p>
                                    <p className="mb-3 mt-1 text-sm text-red-800">
                                        This removes {pet.name} from your profile. It can’t be undone.
                                    </p>
                                    <div className="flex flex-wrap gap-2">
                                        <button
                                            type="button"
                                            onClick={() => setConfirmDelete(null)}
                                            disabled={deleting !== null}
                                            className={secondaryButtonClass}
                                            autoFocus
                                        >
                                            Keep {pet.name}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => void handleDelete(pet)}
                                            disabled={deleting !== null}
                                            className={dangerButtonClass}
                                        >
                                            {deleting === pet.id ? 'Deleting…' : `Delete ${pet.name}`}
                                        </button>
                                    </div>
                                </div>
                            )}
                        </li>
                    )
                ))}
            </ul>
        </section>
    );
}
