import { useEffect, useRef, useState } from 'react';
import type { CatalogItem, Pet } from '../types';
import { loadCatalog } from '../mapApi';
import { useSavedServices } from '../savedServices';
import { dangerTextButtonClass, formatPrice, secondaryButtonClass } from './ui';

interface SavedServicesDrawerProps {
    pet: Pet;
    onShowOnMap: (service: CatalogItem) => void;
    onClose: () => void;
}

// A panel from the right edge listing the services saved for one pet. Mount
// it to open it; it calls onClose on Escape, the close button, or a click on
// the backdrop.
export function SavedServicesDrawer({ pet, onShowOnMap, onClose }: SavedServicesDrawerProps) {
    const dialogRef = useRef<HTMLDialogElement>(null);
    const { ids, remove } = useSavedServices(pet.id);
    const [catalog, setCatalog] = useState<CatalogItem[] | null>(null);
    const [failed, setFailed] = useState(false);

    useEffect(() => {
        dialogRef.current?.showModal();
    }, []);

    useEffect(() => {
        let active = true;
        loadCatalog()
            .then((items) => {
                if (active) setCatalog(items);
            })
            .catch(() => {
                if (active) setFailed(true);
            });
        return () => {
            active = false;
        };
    }, []);

    const byId = new Map((catalog ?? []).map((item) => [item.id, item]));
    // A service removed from the catalog since it was saved is skipped.
    const services = ids.flatMap((id) => byId.get(id) ?? []);

    let body;
    if (ids.length === 0) {
        body = (
            <p className="m-0 rounded-lg bg-gray-50 p-3 text-sm text-gray-700">
                Nothing saved yet. Open a service on the map and choose
                <strong className="font-semibold"> Save</strong>.
            </p>
        );
    } else if (failed) {
        body = (
            <p role="alert" className="m-0 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                Couldn’t load your saved services. Close this and try again.
            </p>
        );
    } else if (catalog === null) {
        body = <p role="status" className="m-0 text-sm text-gray-600">Loading saved services…</p>;
    } else {
        body = (
            <ul className="m-0 list-none space-y-2 p-0">
                {services.map((service) => (
                    <li key={service.id} className="rounded-xl border border-gray-200 bg-white p-3">
                        <p className="m-0 text-xs font-semibold uppercase tracking-wide text-teal-700">
                            {service.category}
                        </p>
                        <p className="m-0 font-semibold text-gray-900">{service.title}</p>
                        <p className="m-0 text-sm text-gray-600">
                            By {service.provider} · {formatPrice(service.price)}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-2">
                            <button
                                type="button"
                                onClick={() => onShowOnMap(service)}
                                className={`${secondaryButtonClass} inline-flex items-center px-3 text-sm`}
                            >
                                <i aria-hidden="true" className="fa-solid fa-location-dot mr-2 text-teal-700"></i>
                                Show on map
                            </button>
                            <button
                                type="button"
                                onClick={() => remove(service.id)}
                                className={`${dangerTextButtonClass} px-3 text-sm`}
                            >
                                Remove
                                <span className="sr-only"> {service.title}</span>
                            </button>
                        </div>
                    </li>
                ))}
            </ul>
        );
    }

    return (
        <dialog
            ref={dialogRef}
            onClose={onClose}
            onClick={(event) => {
                if (event.target === dialogRef.current) dialogRef.current.close();
            }}
            aria-labelledby="saved-services-drawer-title"
            className="m-0 ml-auto h-full max-h-none w-full max-w-md border-0 p-0 shadow-xl backdrop:bg-black/40"
        >
            <div className="flex h-full flex-col">
                <div className="flex shrink-0 items-start justify-between gap-3 border-b border-gray-200 p-5">
                    <div>
                        <h3 id="saved-services-drawer-title" className="m-0 text-xl font-bold text-gray-900">
                            Saved for {pet.name}
                            {ids.length > 0 && <span className="ml-2 text-base font-normal text-gray-600">({ids.length})</span>}
                        </h3>
                        <p className="m-0 mt-1 text-sm text-gray-600">
                            Services you saved for {pet.name} to come back to.
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={() => dialogRef.current?.close()}
                        aria-label="Close saved services"
                        className="min-h-11 min-w-11 shrink-0 rounded-lg border-0 bg-transparent text-xl text-gray-600 hover:bg-gray-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-700"
                    >
                        <i aria-hidden="true" className="fa-solid fa-xmark"></i>
                    </button>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto p-5">{body}</div>
            </div>
        </dialog>
    );
}
