import { useEffect, useRef, useState } from 'react';
import type { CatalogItem, Pet, SavedRecommendation } from '../types';
import {
    dangerButtonClass,
    dangerTextButtonClass,
    formatPrice,
    primaryButtonClass,
    readableTag,
    secondaryButtonClass,
} from './ui';

function formatSavedDate(value: string): string {
    const date = new Date(value);
    return Number.isNaN(date.getTime())
        ? 'Date unavailable'
        : date.toLocaleString(undefined, {
              dateStyle: 'medium',
              timeStyle: 'short',
          });
}

function newestFirst(sets: SavedRecommendation[]): SavedRecommendation[] {
    return [...sets].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

interface SavedRecommendationsProps {
    pet: Pet;
    // Bumped by the page after it saves a list, to reload and open the newest.
    version: number;
    // Called when a list is updated or deleted, so older news can go.
    onAction?: () => void;
}

export function SavedRecommendations({
    pet,
    version,
    onAction,
}: SavedRecommendationsProps) {
    const [sets, setSets] = useState<SavedRecommendation[]>([]);
    const [catalog, setCatalog] = useState<CatalogItem[]>([]);
    const [loadedKey, setLoadedKey] = useState('');
    const [listError, setListError] = useState('');
    const [listRetry, setListRetry] = useState(0);
    const [openId, setOpenId] = useState<string | null>(null);
    // Each list is read on its own (GET /recommendations/:id) when opened,
    // so the panel shows what is stored right now.
    const [details, setDetails] = useState<Record<string, SavedRecommendation>>({});
    const [detailError, setDetailError] = useState<{ id: string; text: string } | null>(null);
    const [detailRetry, setDetailRetry] = useState(0);
    const [busy, setBusy] = useState<{
        id: string;
        action: 'update' | 'delete';
    } | null>(null);
    const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(
        null,
    );
    const [message, setMessage] = useState<{
        kind: 'success' | 'error';
        text: string;
    } | null>(null);

    const requestKey = `${pet.id}:${version}:${listRetry}`;
    const loading = loadedKey !== requestKey && !listError;

    useEffect(() => {
        const controller = new AbortController();
        fetch(`/api/recommendations?petId=${pet.id}`, {
            signal: controller.signal,
        })
            .then((response) => {
                if (!response.ok)
                    throw new Error('Could not load saved lists.');
                return response.json() as Promise<SavedRecommendation[]>;
            })
            .then((data) => {
                const ordered = newestFirst(data);
                setSets(ordered);
                setLoadedKey(requestKey);
                if (version > 0) setOpenId(ordered[0]?.id ?? null);
            })
            .catch((error: unknown) => {
                if (!controller.signal.aborted) {
                    setListError(
                        error instanceof Error
                            ? error.message
                            : 'Could not load saved lists.',
                    );
                }
            });
        return () => controller.abort();
    }, [pet.id, version, requestKey]);

    useEffect(() => {
        if (!openId) return;
        const controller = new AbortController();
        fetch(`/api/recommendations/${openId}`, { signal: controller.signal })
            .then((response) => {
                if (!response.ok) throw new Error();
                return response.json() as Promise<SavedRecommendation>;
            })
            .then((record) => {
                setDetails((current) => ({ ...current, [record.id]: record }));
                setSets((current) =>
                    current.map((item) => (item.id === record.id ? record : item)),
                );
            })
            .catch(() => {
                if (!controller.signal.aborted) {
                    setDetailError({ id: openId, text: 'Could not open this list.' });
                }
            });
        return () => controller.abort();
    }, [openId, detailRetry]);

    // Saved lists keep only service IDs; the catalog supplies the names.
    useEffect(() => {
        const controller = new AbortController();
        fetch('/api/catalog', { signal: controller.signal })
            .then((response) =>
                response.ok
                    ? (response.json() as Promise<CatalogItem[]>)
                    : [],
            )
            .then(setCatalog)
            .catch(() => undefined);
        return () => controller.abort();
    }, []);

    async function refreshSet(set: SavedRecommendation) {
        setBusy({ id: set.id, action: 'update' });
        setMessage(null);
        onAction?.();
        try {
            const response = await fetch(`/api/recommendations/${set.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ limit: set.limit }),
            });
            if (!response.ok) throw new Error();
            const updated = (await response.json()) as SavedRecommendation;
            setSets((current) =>
                current.map((item) => (item.id === updated.id ? updated : item)),
            );
            setDetails((current) => ({ ...current, [updated.id]: updated }));
            setMessage({
                kind: 'success',
                text: `Updated with ${pet.name}’s current needs and today’s services.`,
            });
        } catch {
            setMessage({
                kind: 'error',
                text: 'Could not update this list. Please try again.',
            });
        } finally {
            setBusy(null);
        }
    }

    async function deleteSet(set: SavedRecommendation) {
        setBusy({ id: set.id, action: 'delete' });
        setMessage(null);
        onAction?.();
        try {
            const response = await fetch(`/api/recommendations/${set.id}`, {
                method: 'DELETE',
            });
            if (!response.ok) throw new Error();
            setSets((current) => current.filter((item) => item.id !== set.id));
            setConfirmDeleteId(null);
            setMessage({ kind: 'success', text: 'Saved list deleted.' });
        } catch {
            setMessage({
                kind: 'error',
                text: 'Could not delete this list. Please try again.',
            });
        } finally {
            setBusy(null);
        }
    }

    const catalogById = new Map(catalog.map((service) => [service.id, service]));
    const titleOf = (serviceId: number) =>
        catalogById.get(serviceId)?.title ?? `Service #${serviceId}`;

    return (
        <div aria-busy={loading}>
            {message && (
                <p
                    role={message.kind === 'error' ? 'alert' : 'status'}
                    className={`mb-4 rounded-lg p-3 ${message.kind === 'error' ? 'bg-red-50 text-red-800' : 'bg-green-50 text-green-900'}`}
                >
                    {message.text}
                </p>
            )}

            {loading && (
                <div role="status" className="animate-pulse space-y-3">
                    <span className="sr-only">Loading saved lists...</span>
                    <div className="h-16 rounded-xl bg-gray-100"></div>
                    <div className="h-16 rounded-xl bg-gray-100"></div>
                </div>
            )}

            {listError && (
                <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">
                    <p className="m-0">{listError}</p>
                    <button
                        type="button"
                        onClick={() => {
                            setListError('');
                            setListRetry((count) => count + 1);
                        }}
                        className={`${secondaryButtonClass} mt-3`}
                    >
                        Try again
                    </button>
                </div>
            )}

            {!loading && !listError && sets.length === 0 && (
                <p className="m-0 rounded-xl border border-dashed border-gray-300 p-4 text-gray-600">
                    No saved lists yet. Save a snapshot above to compare{' '}
                    {pet.name}’s picks later.
                </p>
            )}

            {!loading && !listError && sets.length > 0 && (
                <ul className="m-0 list-none space-y-3 p-0">
                    {sets.map((set) => {
                        const open = openId === set.id;
                        const panelId = `saved-${set.id}`;
                        const isBusy = busy?.id === set.id;
                        const preview = set.matches
                            .slice(0, 3)
                            .map((match) => titleOf(match.serviceId))
                            .join(', ');
                        return (
                            <li
                                key={set.id}
                                className={`rounded-xl border bg-white ${open ? 'border-teal-300 shadow-sm' : 'border-gray-200'}`}
                            >
                                <button
                                    type="button"
                                    aria-expanded={open}
                                    aria-controls={panelId}
                                    onClick={() => {
                                        setOpenId(open ? null : set.id);
                                        setConfirmDeleteId(null);
                                        setDetailError(null);
                                    }}
                                    className="flex min-h-11 w-full items-center gap-4 rounded-xl p-4 text-left hover:bg-gray-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
                                >
                                    <span className="min-w-0 flex-1">
                                        <span className="block font-semibold text-gray-900">
                                            {formatSavedDate(set.createdAt)}
                                            <span className="ml-2 font-normal text-gray-600">
                                                · {set.matches.length}{' '}
                                                {set.matches.length === 1 ? 'service' : 'services'}
                                            </span>
                                        </span>
                                        {preview && (
                                            <span className="mt-0.5 block truncate text-sm text-gray-600">
                                                {preview}
                                                {set.matches.length > 3 ? '…' : ''}
                                            </span>
                                        )}
                                    </span>
                                    <i
                                        aria-hidden="true"
                                        className={`fa-solid fa-chevron-down text-gray-500 transition-transform ${open ? 'rotate-180' : ''}`}
                                    ></i>
                                </button>

                                {open && detailError?.id === set.id && (
                                    <div id={panelId} role="alert" className="border-t border-gray-200 p-4 text-red-800">
                                        <p className="m-0">{detailError.text}</p>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setDetailError(null);
                                                setDetailRetry((count) => count + 1);
                                            }}
                                            className={`${secondaryButtonClass} mt-3`}
                                        >
                                            Try again
                                        </button>
                                    </div>
                                )}

                                {open && !detailError && !details[set.id] && (
                                    <div id={panelId} role="status" className="animate-pulse space-y-2 border-t border-gray-200 p-4">
                                        <span className="sr-only">Opening saved list...</span>
                                        <div className="h-10 rounded bg-gray-100"></div>
                                        <div className="h-10 rounded bg-gray-100"></div>
                                    </div>
                                )}

                                {open && !detailError && details[set.id] && (
                                    <div id={panelId} className="border-t border-gray-200 px-4 pb-4">
                                        {set.matches.length === 0 ? (
                                            <p className="mt-4 text-gray-700">
                                                Nothing fit {pet.name}’s needs and budget when this was saved.
                                            </p>
                                        ) : (
                                            <ol className="m-0 list-none divide-y divide-gray-100 p-0">
                                                {set.matches.map((match, index) => {
                                                    const service = catalogById.get(match.serviceId);
                                                    return (
                                                        <li key={match.serviceId} className="flex items-start gap-3 py-3">
                                                            <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-teal-50 text-xs font-bold text-teal-800">
                                                                {index + 1}
                                                            </span>
                                                            <div className="min-w-0 flex-1">
                                                                <p className="m-0 font-semibold text-gray-900">
                                                                    {titleOf(match.serviceId)}
                                                                </p>
                                                                <p className="m-0 text-sm capitalize text-gray-600">
                                                                    {service && `${service.provider} · `}
                                                                    {match.matchedNeeds.length > 0
                                                                        ? `Covers ${match.matchedNeeds.map(readableTag).join(', ')}`
                                                                        : 'Top rated within budget'}
                                                                </p>
                                                            </div>
                                                            {service && (
                                                                <strong className="shrink-0 text-gray-900">{formatPrice(service.price)}</strong>
                                                            )}
                                                        </li>
                                                    );
                                                })}
                                            </ol>
                                        )}

                                        <p className="mb-0 mt-2 text-xs text-gray-500">
                                            Last updated {formatSavedDate(set.updatedAt)}
                                        </p>

                                        {confirmDeleteId === set.id ? (
                                            <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4">
                                                <p className="m-0 font-semibold text-red-900">
                                                    Delete this saved list? This cannot be undone.
                                                </p>
                                                <div className="mt-3 flex flex-wrap gap-3">
                                                    <button
                                                        type="button"
                                                        onClick={() => setConfirmDeleteId(null)}
                                                        disabled={isBusy}
                                                        className={secondaryButtonClass}
                                                    >
                                                        Keep it
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => deleteSet(set)}
                                                        disabled={isBusy}
                                                        className={dangerButtonClass}
                                                    >
                                                        {isBusy && busy?.action === 'delete' ? 'Deleting...' : 'Delete list'}
                                                    </button>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="mt-4 flex flex-wrap gap-3">
                                                <button
                                                    type="button"
                                                    onClick={() => refreshSet(set)}
                                                    disabled={busy !== null}
                                                    className={secondaryButtonClass}
                                                >
                                                    <i
                                                        aria-hidden="true"
                                                        className={`fa-solid fa-rotate-right mr-2 ${isBusy && busy?.action === 'update' ? 'fa-spin' : ''}`}
                                                    ></i>
                                                    {isBusy && busy?.action === 'update' ? 'Updating...' : 'Update with latest'}
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setConfirmDeleteId(set.id)}
                                                    disabled={busy !== null}
                                                    className={dangerTextButtonClass}
                                                >
                                                    Delete
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </li>
                        );
                    })}
                </ul>
            )}
        </div>
    );
}

// How many matches a new snapshot keeps.
const SNAPSHOT_SIZE = 10;

interface SavedListsDrawerProps {
    pet: Pet;
    onClose: () => void;
}

// A panel from the right edge. Mount it to open it; it calls onClose on
// Escape, the close button, or a click on the backdrop.
export function SavedListsDrawer({ pet, onClose }: SavedListsDrawerProps) {
    const dialogRef = useRef<HTMLDialogElement>(null);
    const [version, setVersion] = useState(0);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<{
        kind: 'success' | 'error';
        text: string;
    } | null>(null);

    useEffect(() => {
        dialogRef.current?.showModal();
    }, []);

    async function saveSnapshot() {
        setSaving(true);
        setMessage(null);
        try {
            const response = await fetch('/api/recommendations', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ petId: pet.id, limit: SNAPSHOT_SIZE }),
            });
            if (!response.ok) throw new Error();
            setVersion((value) => value + 1);
            setMessage({ kind: 'success', text: 'Saved. It’s open below.' });
        } catch {
            setMessage({
                kind: 'error',
                text: 'Could not save a snapshot. Please try again.',
            });
        } finally {
            setSaving(false);
        }
    }

    return (
        <dialog
            ref={dialogRef}
            onClose={onClose}
            onClick={(event) => {
                if (event.target === dialogRef.current) dialogRef.current.close();
            }}
            aria-labelledby="saved-lists-title"
            className="m-0 ml-auto h-full max-h-none w-full max-w-md border-0 p-0 shadow-xl backdrop:bg-black/40"
        >
            <div className="flex h-full flex-col">
                <div className="flex shrink-0 items-start justify-between gap-3 border-b border-gray-200 p-5">
                    <div>
                        <h3 id="saved-lists-title" className="m-0 text-xl font-bold text-gray-900">
                            Saved lists for {pet.name}
                        </h3>
                        <p className="m-0 mt-1 text-sm text-gray-600">
                            Snapshots to compare later. Update one any time to
                            use {pet.name}’s current needs and the latest services.
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={() => dialogRef.current?.close()}
                        aria-label="Close saved lists"
                        className="min-h-11 min-w-11 shrink-0 rounded-lg border-0 bg-transparent text-xl text-gray-600 hover:bg-gray-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-700"
                    >
                        <i aria-hidden="true" className="fa-solid fa-xmark"></i>
                    </button>
                </div>

                <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-5">
                    <div className="rounded-xl border border-teal-100 bg-teal-50 p-4">
                        <p className="m-0 font-semibold text-gray-900">
                            Save {pet.name}’s top {SNAPSHOT_SIZE} matches
                        </p>
                        <p className="m-0 mt-1 text-sm text-gray-700">
                            Ranked across all services, not just the area on the map.
                        </p>
                        <button
                            type="button"
                            onClick={saveSnapshot}
                            disabled={saving}
                            className={`${primaryButtonClass} mt-3`}
                        >
                            <i aria-hidden="true" className="fa-regular fa-bookmark mr-2"></i>
                            {saving ? 'Saving...' : 'Save snapshot'}
                        </button>
                        {message && (
                            <p
                                role={message.kind === 'error' ? 'alert' : 'status'}
                                className={`m-0 mt-3 text-sm font-medium ${message.kind === 'error' ? 'text-red-800' : 'text-green-800'}`}
                            >
                                {message.text}
                            </p>
                        )}
                    </div>

                    <SavedRecommendations
                        pet={pet}
                        version={version}
                        onAction={() => setMessage(null)}
                    />
                </div>
            </div>
        </dialog>
    );
}
