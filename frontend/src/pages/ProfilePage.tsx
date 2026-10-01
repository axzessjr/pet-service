import { useState, useEffect } from 'react';
import type { FormEvent } from 'react';
import type { CatalogItem, Pet } from '../types';
import type { User } from '../App';
import { useLoading } from '../context/LoadingContext';

interface ProfilePageProps {
    currentUser: User | null;
}

interface PetForm {
    name: string;
    species: string;
    needs: string[];
    maxPrice: string;
}

const EMPTY_FORM: PetForm = { name: '', species: 'dog', needs: [], maxPrice: '' };

function readableTag(tag: string): string {
    const text = tag.replaceAll('-', ' ');
    return text.charAt(0).toUpperCase() + text.slice(1);
}

export function ProfilePage({ currentUser }: ProfilePageProps) {
    const [loading, setLocalLoading] = useState<boolean>(true);
    const [pets, setPets] = useState<Pet[]>([]);
    const { setLoading: setGlobalLoading } = useLoading();

    // null = form hidden, 'new' = creating, number = editing that pet id
    const [editingId, setEditingId] = useState<number | 'new' | null>(null);
    const [form, setForm] = useState<PetForm>(EMPTY_FORM);
    const [error, setError] = useState<string | null>(null);
    const [catalog, setCatalog] = useState<CatalogItem[]>([]);

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

    const fetchPets = async () => {
        if (!currentUser?.id) {
            setLocalLoading(false);
            return;
        }

        setLocalLoading(true);
        setGlobalLoading(true);

        try {
            const response = await fetch(`/api/pet-profile/me?userId=${currentUser.id}`, {
                method: 'GET'
            });
            const data = await response.json();

            if (response.ok) {
                setPets(data);
            }
        } catch (error) {
            console.error('Error fetching pets:', error);
        } finally {
            setLocalLoading(false);
            setGlobalLoading(false);
        }
    };

    useEffect(() => {
        fetchPets();
    }, [currentUser?.id]);

    const openCreateForm = () => {
        setForm(EMPTY_FORM);
        setError(null);
        setEditingId('new');
    };

    const openEditForm = (pet: Pet) => {
        setForm({
            name: pet.name,
            species: pet.species,
            needs: pet.needs,
            maxPrice: String(pet.maxPrice),
        });
        setError(null);
        setEditingId(pet.id);
    };

    const closeForm = () => {
        setEditingId(null);
        setError(null);
    };

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        if (!currentUser?.id || editingId === null) return;

        const payload = {
            userId: currentUser.id,
            name: form.name.trim(),
            species: form.species.trim(),
            needs: form.needs,
            maxPrice: Number(form.maxPrice || 0),
        };

        const isNew = editingId === 'new';
        setGlobalLoading(true);

        try {
            const response = await fetch(
                isNew ? '/api/pet-profile' : `/api/pet-profile/${editingId}`,
                {
                    method: isNew ? 'POST' : 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                },
            );
            const data = await response.json();

            if (!response.ok) {
                setError(data.message ?? 'Failed to save pet');
                return;
            }

            setPets((prev) => isNew
                ? [...prev, data]
                : prev.map((p) => (p.id === data.id ? data : p)));
            closeForm();
        } catch (error) {
            console.error('Error saving pet:', error);
            setError('Failed to save pet');
        } finally {
            setGlobalLoading(false);
        }
    };

    const handleDelete = async (pet: Pet) => {
        if (!currentUser?.id) return;
        if (!window.confirm(`Delete ${pet.name}? This cannot be undone.`)) return;

        setGlobalLoading(true);

        try {
            const response = await fetch(`/api/pet-profile/${pet.id}?userId=${currentUser.id}`, {
                method: 'DELETE'
            });

            if (response.ok) {
                setPets((prev) => prev.filter((p) => p.id !== pet.id));
                if (editingId === pet.id) closeForm();
            }
        } catch (error) {
            console.error('Error deleting pet:', error);
        } finally {
            setGlobalLoading(false);
        }
    };

    const petForm = (
        <form
            onSubmit={handleSubmit}
            className="bg-white p-4 rounded-lg border border-blue-200 shadow-sm space-y-3"
        >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="block">
                    <span className="text-sm font-semibold text-gray-700">Name</span>
                    <input
                        required
                        value={form.name}
                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                        className="mt-1 w-full border border-gray-300 rounded-md px-3 py-2"
                    />
                </label>
                <label className="block">
                    <span className="text-sm font-semibold text-gray-700">Species</span>
                    <select
                        value={form.species}
                        onChange={(e) => changeSpecies(e.target.value)}
                        className="mt-1 w-full border border-gray-300 rounded-md px-3 py-2 bg-white"
                    >
                        <option value="dog">Dog</option>
                        <option value="cat">Cat</option>
                    </select>
                </label>
                <fieldset className="sm:col-span-2 border-0 p-0 m-0 min-w-0">
                    <legend className="text-sm font-semibold text-gray-700 p-0">Needs</legend>
                    <div className="mt-2 flex flex-wrap gap-2">
                        {[...speciesTags, ...legacyNeeds].map((tag) => {
                            const checked = form.needs.includes(tag);
                            const isLegacy = legacyNeeds.includes(tag);
                            return (
                                <label
                                    key={tag}
                                    title={isLegacy ? 'No services match this need — uncheck to remove it' : undefined}
                                    className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm cursor-pointer select-none has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-blue-600 ${
                                        isLegacy
                                            ? 'border-amber-300 bg-amber-50 text-amber-800 line-through'
                                            : checked
                                                ? 'border-blue-600 bg-blue-600 text-white'
                                                : 'border-gray-300 bg-white text-gray-700 hover:border-blue-400'
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
                            <span className="text-sm text-gray-500">Loading options…</span>
                        )}
                    </div>
                    {legacyNeeds.length > 0 && (
                        <p className="mt-2 mb-0 text-xs text-amber-700">
                            Crossed-out needs don't match any service. Uncheck them and pick from the list instead.
                        </p>
                    )}
                </fieldset>
                <label className="block">
                    <span className="text-sm font-semibold text-gray-700">Budget ($)</span>
                    <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={form.maxPrice}
                        onChange={(e) => setForm({ ...form, maxPrice: e.target.value })}
                        className="mt-1 w-full border border-gray-300 rounded-md px-3 py-2"
                    />
                </label>
            </div>

            {error && <p className="text-red-600 text-sm m-0">{error}</p>}

            <div className="flex gap-2 justify-end">
                <button
                    type="button"
                    onClick={closeForm}
                    className="bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-2 px-4 rounded-lg transition-colors cursor-pointer border-0"
                >
                    Cancel
                </button>
                <button
                    type="submit"
                    className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg transition-colors cursor-pointer border-0"
                >
                    {editingId === 'new' ? 'Add Pet' : 'Save Changes'}
                </button>
            </div>
        </form>
    );

    return (
        <div>
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold text-gray-800 m-0">
                    👤 My Profile
                </h2>
                <button
                    onClick={fetchPets}
                    className="bg-blue-100 hover:bg-blue-200 text-blue-700 font-bold py-2 px-4 rounded-lg transition-colors flex items-center gap-2 cursor-pointer border-0"
                >
                    <i className={`fa-solid fa-rotate-right ${loading ? 'fa-spin' : ''}`}></i>
                    Refresh
                </button>
            </div>

            <div className="bg-gray-50 p-5 rounded-xl border border-gray-200 mb-8 shadow-sm">
                <p className="text-gray-700 mb-2">
                    <strong className="text-gray-900 mr-2">Name:</strong>
                    {currentUser?.firstname} {currentUser?.lastname}
                </p>
                <p className="text-gray-700">
                    <strong className="text-gray-900 mr-2">Email:</strong>
                    {currentUser?.email}
                </p>
            </div>

            <div className="flex justify-between items-center mb-3">
                <h3 className="text-xl font-bold text-gray-800 m-0">My Pets</h3>
                {editingId === null && (
                    <button
                        onClick={openCreateForm}
                        className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg transition-colors flex items-center gap-2 cursor-pointer border-0"
                    >
                        <i className="fa-solid fa-plus"></i>
                        Add Pet
                    </button>
                )}
            </div>

            {editingId === 'new' && <div className="mb-3">{petForm}</div>}

            {!loading && pets.length === 0 && editingId !== 'new' && (
                <p className="text-gray-500">You haven't added any pets yet.</p>
            )}

            <ul className="list-none p-0 space-y-3">
                {pets.map((pet) => (
                    editingId === pet.id ? (
                        <li key={pet.id}>{petForm}</li>
                    ) : (
                        <li
                            key={pet.id}
                            className="bg-blue-50 p-4 rounded-lg border border-blue-100 flex items-center shadow-sm"
                        >
                            <strong className="text-blue-900 text-lg mr-2">
                                {pet.name}
                            </strong>
                            <span className="text-blue-700 bg-blue-100 px-2 py-1 rounded-md text-sm font-semibold">
                                {pet.species}
                            </span>
                            <span className="ml-3 text-sm text-gray-700">
                                Needs: {pet.needs.map(readableTag).join(', ') || '—'} · Budget: $
                                {pet.maxPrice}
                            </span>
                            <div className="ml-auto flex gap-2">
                                <button
                                    onClick={() => openEditForm(pet)}
                                    title="Edit"
                                    className="text-blue-700 hover:bg-blue-100 p-2 rounded-md cursor-pointer border-0 bg-transparent"
                                >
                                    <i className="fa-solid fa-pen"></i>
                                </button>
                                <button
                                    onClick={() => handleDelete(pet)}
                                    title="Delete"
                                    className="text-red-600 hover:bg-red-100 p-2 rounded-md cursor-pointer border-0 bg-transparent"
                                >
                                    <i className="fa-solid fa-trash"></i>
                                </button>
                            </div>
                        </li>
                    )
                ))}
            </ul>
        </div>
    )
}
