import { useEffect, useState, type FormEvent } from 'react';
import type {
    CatalogItem,
    Pet,
    SavedRecommendation,
} from '../types';

const controlClass =
    'min-h-11 rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700';
const primaryButtonClass =
    'min-h-11 rounded-lg bg-teal-700 px-4 py-2 font-semibold text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700';
const secondaryButtonClass =
    'min-h-11 rounded-lg border border-gray-300 bg-white px-4 py-2 font-semibold text-gray-800 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700';

function parseLimit(value: string): number | null {
    const limit = Number(value);
    return Number.isSafeInteger(limit) && limit >= 1 && limit <= 100
        ? limit
        : null;
}

function formatDate(value: string): string {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? 'Date unavailable' : date.toLocaleString();
}

function readableTag(tag: string): string {
    return tag.replaceAll('-', ' ');
}

interface SavedRecommendationsProps {
    pet: Pet;
}

export function SavedRecommendations({ pet }: SavedRecommendationsProps) {
    const [sets, setSets] = useState<SavedRecommendation[]>([]);
    const [catalog, setCatalog] = useState<CatalogItem[]>([]);
    const [loadingSets, setLoadingSets] = useState(true);
    const [listError, setListError] = useState('');
    const [catalogError, setCatalogError] = useState('');
    const [listRetry, setListRetry] = useState(0);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [detail, setDetail] = useState<SavedRecommendation | null>(null);
    const [loadingDetail, setLoadingDetail] = useState(false);
    const [detailError, setDetailError] = useState('');
    const [detailRetry, setDetailRetry] = useState(0);
    const [createLimit, setCreateLimit] = useState('5');
    const [editLimit, setEditLimit] = useState('5');
    const [createLimitError, setCreateLimitError] = useState('');
    const [editLimitError, setEditLimitError] = useState('');
    const [busyAction, setBusyAction] = useState<'create' | 'update' | 'delete' | null>(null);
    const [actionError, setActionError] = useState('');
    const [notice, setNotice] = useState('');
    const [confirmDelete, setConfirmDelete] = useState(false);

    useEffect(() => {
        const controller = new AbortController();
        fetch(`/api/recommendations?petId=${pet.id}`, { signal: controller.signal })
            .then((response) => {
                if (!response.ok) throw new Error('Could not load saved sets.');
                return response.json() as Promise<SavedRecommendation[]>;
            })
            .then((data) => setSets(data))
            .catch((error: unknown) => {
                if (!controller.signal.aborted) {
                    setListError(error instanceof Error ? error.message : 'Could not load saved sets.');
                }
            })
            .finally(() => {
                if (!controller.signal.aborted) setLoadingSets(false);
            });
        return () => controller.abort();
    }, [pet.id, listRetry]);

    useEffect(() => {
        const controller = new AbortController();
        fetch('/api/catalog', { signal: controller.signal })
            .then((response) => {
                if (!response.ok) throw new Error('Catalog details are unavailable.');
                return response.json() as Promise<CatalogItem[]>;
            })
            .then((data) => setCatalog(data))
            .catch(() => {
                if (!controller.signal.aborted) setCatalogError('Catalog details are unavailable. Service IDs are shown instead.');
            });
        return () => controller.abort();
    }, []);

    useEffect(() => {
        if (!selectedId) return;
        const controller = new AbortController();
        fetch(`/api/recommendations/${selectedId}`, { signal: controller.signal })
            .then((response) => {
                if (!response.ok) throw new Error('Could not open this saved set.');
                return response.json() as Promise<SavedRecommendation>;
            })
            .then((data) => {
                setDetail(data);
                setEditLimit(String(data.limit));
            })
            .catch((error: unknown) => {
                if (!controller.signal.aborted) {
                    setDetailError(error instanceof Error ? error.message : 'Could not open this saved set.');
                }
            })
            .finally(() => {
                if (!controller.signal.aborted) setLoadingDetail(false);
            });
        return () => controller.abort();
    }, [selectedId, detailRetry]);

    function openSet(id: string) {
        setSelectedId(id);
        setDetail(null);
        setDetailError('');
        setLoadingDetail(true);
        setEditLimitError('');
        setConfirmDelete(false);
        setActionError('');
        setNotice('');
        if (id === selectedId) setDetailRetry((count) => count + 1);
    }

    async function createSet(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const limit = parseLimit(createLimit);
        if (limit === null) {
            setCreateLimitError('Enter a whole number from 1 to 100.');
            return;
        }
        setCreateLimitError('');
        setActionError('');
        setNotice('');
        setBusyAction('create');
        try {
            const response = await fetch('/api/recommendations', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ petId: pet.id, limit }),
            });
            if (!response.ok) throw new Error('Could not save a recommendation set. Please try again.');
            const saved = (await response.json()) as SavedRecommendation;
            setSets((current) => [saved, ...current]);
            setListError('');
            openSet(saved.id);
            setNotice('Recommendation set saved.');
        } catch (error) {
            setActionError(error instanceof Error ? error.message : 'Could not save a recommendation set.');
        } finally {
            setBusyAction(null);
        }
    }

    async function updateSet(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (!detail) return;
        const limit = parseLimit(editLimit);
        if (limit === null) {
            setEditLimitError('Enter a whole number from 1 to 100.');
            return;
        }
        setEditLimitError('');
        setActionError('');
        setNotice('');
        setBusyAction('update');
        try {
            const response = await fetch(`/api/recommendations/${detail.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ limit }),
            });
            if (!response.ok) throw new Error('Could not recalculate this set. Please try again.');
            const updated = (await response.json()) as SavedRecommendation;
            setSets((current) => current.map((set) => set.id === updated.id ? updated : set));
            setDetail(updated);
            setNotice('Recommendation set recalculated.');
        } catch (error) {
            setActionError(error instanceof Error ? error.message : 'Could not recalculate this set.');
        } finally {
            setBusyAction(null);
        }
    }

    async function deleteSet() {
        if (!detail) return;
        setActionError('');
        setNotice('');
        setBusyAction('delete');
        try {
            const response = await fetch(`/api/recommendations/${detail.id}`, {
                method: 'DELETE',
            });
            if (!response.ok) throw new Error('Could not delete this set. Please try again.');
            setSets((current) => current.filter((set) => set.id !== detail.id));
            setSelectedId(null);
            setDetail(null);
            setConfirmDelete(false);
            setNotice('Recommendation set deleted.');
        } catch (error) {
            setActionError(error instanceof Error ? error.message : 'Could not delete this set.');
        } finally {
            setBusyAction(null);
        }
    }

    const catalogById = new Map(catalog.map((service) => [service.id, service]));

    return (
        <section className="mt-10 border-t border-gray-200 pt-8" aria-labelledby="saved-heading">
            <h3 id="saved-heading" className="m-0 text-2xl font-bold text-gray-900">Saved recommendation sets</h3>
            <p className="mt-2 text-gray-600">Save a snapshot for {pet.name}, then open it later or recalculate it using current pet and service details.</p>

            <form onSubmit={createSet} className="mt-5 rounded-2xl border border-teal-100 bg-teal-50 p-5">
                <label htmlFor="create-limit" className="block font-semibold text-gray-900">Number of services</label>
                <p className="mb-3 mt-1 text-sm text-gray-700">Choose how many matching services to include, up to 100.</p>
                <div className="flex flex-wrap items-end gap-3">
                    <input id="create-limit" type="number" min="1" max="100" step="1" required value={createLimit}
                        onChange={(event) => setCreateLimit(event.target.value)} aria-invalid={!!createLimitError}
                        aria-describedby={createLimitError ? 'create-limit-error' : undefined}
                        className={`${controlClass} w-24`} disabled={busyAction !== null || loadingSets} />
                    <button type="submit" disabled={busyAction !== null || loadingSets} className={primaryButtonClass}>
                        {busyAction === 'create' ? 'Saving...' : 'Generate and save set'}
                    </button>
                </div>
                {createLimitError && <p id="create-limit-error" className="mb-0 mt-2 text-sm text-red-800">{createLimitError}</p>}
            </form>

            {notice && <p role="status" className="mt-4 rounded-lg bg-green-50 p-3 text-green-900">{notice}</p>}
            {actionError && <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-red-800">{actionError}</p>}

            <div className="mt-6 grid gap-6 lg:grid-cols-5">
                <div className="lg:col-span-2" aria-busy={loadingSets}>
                    <h4 className="mb-3 text-lg font-bold text-gray-900">Saved sets for {pet.name}</h4>
                    {loadingSets && <p role="status" className="text-gray-600">Loading saved sets...</p>}
                    {listError && <div role="alert" className="rounded-lg bg-red-50 p-4 text-red-800">
                        <p className="m-0">{listError}</p>
                        <button type="button" disabled={busyAction !== null} onClick={() => { setListError(''); setLoadingSets(true); setListRetry((count) => count + 1); }}
                            className={`${secondaryButtonClass} mt-3`}>Try again</button>
                    </div>}
                    {!loadingSets && !listError && sets.length === 0 && <p className="rounded-lg bg-gray-100 p-4 text-gray-700">No saved sets yet. Generate one above.</p>}
                    {!loadingSets && !listError && sets.length > 0 && <ul className="m-0 list-none space-y-3 p-0">
                        {sets.map((set) => <li key={set.id}>
                            <button type="button" onClick={() => openSet(set.id)} disabled={busyAction !== null}
                                aria-current={selectedId === set.id ? 'true' : undefined}
                                className={`min-h-11 w-full rounded-xl border p-4 text-left hover:border-teal-500 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 ${selectedId === set.id ? 'border-teal-600 bg-teal-50' : 'border-gray-200 bg-white'}`}>
                                <span className="block font-semibold text-gray-900">Saved {formatDate(set.createdAt)}</span>
                                <span className="mt-1 block text-sm text-gray-600">{set.matches.length} services · Limit {set.limit}</span>
                            </button>
                        </li>)}
                    </ul>}
                </div>

                <div className="min-w-0 lg:col-span-3" aria-busy={loadingDetail}>
                    <h4 className="mb-3 text-lg font-bold text-gray-900">Set details</h4>
                    {!selectedId && <p className="rounded-lg bg-gray-100 p-4 text-gray-700">Select a saved set to see its services and manage it.</p>}
                    {loadingDetail && <p role="status" className="text-gray-600">Opening saved set...</p>}
                    {detailError && <div role="alert" className="rounded-lg bg-red-50 p-4 text-red-800">
                        <p className="m-0">{detailError}</p>
                        <button type="button" onClick={() => { if (selectedId) openSet(selectedId); }} className={`${secondaryButtonClass} mt-3`}>Try again</button>
                    </div>}
                    {detail && !loadingDetail && !detailError && <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                        <p className="m-0 text-sm text-gray-600">Saved {formatDate(detail.createdAt)} · Last recalculated {formatDate(detail.updatedAt)}</p>
                        {catalogError && <p role="status" className="mt-3 text-sm text-amber-800">{catalogError}</p>}
                        {detail.matches.length === 0 ? <p className="mt-4 text-gray-700">No services matched this pet's needs and budget when this set was saved.</p> :
                            <ul className="mt-4 list-none divide-y divide-gray-200 p-0">
                                {detail.matches.map((match) => {
                                    const service = catalogById.get(match.serviceId);
                                    return <li key={match.serviceId} className="py-4 first:pt-0 last:pb-0">
                                        <div className="flex flex-wrap items-start justify-between gap-2">
                                            <div className="min-w-0">
                                                <p className="m-0 font-semibold text-gray-900">{service?.title ?? `Service #${match.serviceId}`}</p>
                                                {service && <p className="mb-0 mt-1 text-sm text-gray-600">{service.provider} · ${service.price}</p>}
                                            </div>
                                            <span className="text-sm font-semibold text-teal-800">Similarity {Math.round(match.score * 100)}%</span>
                                        </div>
                                        {match.matchedNeeds.length > 0 && <p className="mb-0 mt-2 text-sm text-gray-700">Matches {match.matchedNeeds.map(readableTag).join(' and ')}</p>}
                                    </li>;
                                })}
                            </ul>}

                        <div className="mt-5 border-t border-gray-200 pt-5">
                            <form onSubmit={updateSet}>
                                <label htmlFor="edit-limit" className="block font-semibold text-gray-900">Recalculate with up to</label>
                                <p className="mb-3 mt-1 text-sm text-gray-600">Uses the pet's current needs, budget, and available services.</p>
                                <div className="flex flex-wrap items-end gap-3">
                                    <input id="edit-limit" type="number" min="1" max="100" step="1" required value={editLimit}
                                        onChange={(event) => setEditLimit(event.target.value)} aria-invalid={!!editLimitError}
                                        aria-describedby={editLimitError ? 'edit-limit-error' : undefined}
                                        className={`${controlClass} w-24`} disabled={busyAction !== null} />
                                    <button type="submit" disabled={busyAction !== null} className={secondaryButtonClass}>
                                        {busyAction === 'update' ? 'Recalculating...' : 'Recalculate set'}
                                    </button>
                                </div>
                                {editLimitError && <p id="edit-limit-error" className="mb-0 mt-2 text-sm text-red-800">{editLimitError}</p>}
                            </form>
                            <div className="mt-5">
                                {!confirmDelete ? <button type="button" onClick={() => setConfirmDelete(true)} disabled={busyAction !== null}
                                    className="min-h-11 rounded-lg px-4 py-2 font-semibold text-red-800 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-800">Delete set</button> :
                                    <div className="rounded-lg border border-red-200 bg-red-50 p-4">
                                        <p className="m-0 font-semibold text-red-900">Delete this saved set?</p>
                                        <p className="mb-3 mt-1 text-sm text-red-800">This cannot be undone.</p>
                                        <div className="flex flex-wrap gap-3">
                                            <button type="button" onClick={() => setConfirmDelete(false)} disabled={busyAction !== null} className={secondaryButtonClass}>Cancel</button>
                                            <button type="button" onClick={deleteSet} disabled={busyAction !== null}
                                                className="min-h-11 rounded-lg bg-red-800 px-4 py-2 font-semibold text-white hover:bg-red-900 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-800">
                                                {busyAction === 'delete' ? 'Deleting...' : 'Delete saved set'}
                                            </button>
                                        </div>
                                    </div>}
                            </div>
                        </div>
                    </div>}
                </div>
            </div>
        </section>
    );
}
