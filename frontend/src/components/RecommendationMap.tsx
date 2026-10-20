import {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
    type ReactNode,
} from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
    MapContainer,
    Marker,
    Popup,
    TileLayer,
    ZoomControl,
    useMap,
} from 'react-leaflet';
import type { MapMode, MapRecommendation, Pet } from '../types';
import {
    barelyChanged,
    CHULA,
    DEBOUNCE_MS,
    DEFAULT_ZOOM,
    MAX_ZOOM,
    MIN_ZOOM,
    type Viewport,
} from '../mapApi';
import { RatingSummary } from './Stars';
import {
    categoryColor,
    categoryIcon,
    matchLabel,
    readableTag,
    UNMATCHED_COLOR,
} from './ui';

const CAMPUS_ICON = L.divIcon({
    className: '',
    html: `<span class="flex h-10 w-10 items-center justify-center rounded-full border-4 border-white bg-pink-700 text-white shadow-lg"><i class="fa-solid fa-building-columns"></i></span>`,
    iconSize: [40, 40],
    iconAnchor: [20, 20],
    popupAnchor: [0, -20],
});

function pinIcon(
    item: MapRecommendation,
    rank: number | undefined,
    highlighted: boolean,
): L.DivIcon {
    const color = item.matched
        ? categoryColor(item.service.category)
        : UNMATCHED_COLOR;
    const label =
        rank !== undefined
            ? `<span class="text-sm font-bold">${rank}</span>`
            : `<i class="fa-solid ${categoryIcon(item.service.category)} text-xs"></i>`;
    const size = highlighted ? 40 : 30;
    return L.divIcon({
        className: '',
        html: `<span class="flex items-center justify-center rounded-full border-2 border-white text-white shadow-md transition-transform ${highlighted ? 'ring-4 ring-amber-400' : ''} ${item.matched ? '' : 'opacity-80'}" style="width:${size}px;height:${size}px;background:${color}">${label}</span>`,
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2],
        popupAnchor: [0, -size / 2],
    });
}

function readViewport(map: L.Map): Viewport {
    const bounds = map.getBounds();
    const center = map.getCenter();
    return {
        bounds: {
            minLat: bounds.getSouth(),
            minLng: bounds.getWest(),
            maxLat: bounds.getNorth(),
            maxLng: bounds.getEast(),
        },
        zoom: Math.round(map.getZoom()),
        center: { lat: center.lat, lng: center.lng },
    };
}

// Reports the visible area once on load, then after each pan or zoom has
// settled for DEBOUNCE_MS. Tiny moves are ignored.
function ViewportWatcher({
    onChange,
}: {
    onChange: (viewport: Viewport) => void;
}) {
    const map = useMap();
    const onChangeRef = useRef(onChange);
    useEffect(() => {
        onChangeRef.current = onChange;
    });

    useEffect(() => {
        let last: Viewport | null = null;
        let timer: number | undefined;
        const emit = () => {
            const next = readViewport(map);
            if (last && barelyChanged(last, next)) return;
            last = next;
            onChangeRef.current(next);
        };
        const schedule = () => {
            window.clearTimeout(timer);
            timer = window.setTimeout(emit, DEBOUNCE_MS);
        };
        const cancel = () => window.clearTimeout(timer);
        emit();
        map.on('moveend', schedule);
        map.on('movestart', cancel);
        return () => {
            cancel();
            map.off('moveend', schedule);
            map.off('movestart', cancel);
        };
    }, [map]);
    return null;
}

export interface FocusRequest {
    id: number;
    // Changes on every request, so asking for the same service again works.
    nonce: number;
}

interface RecommendationMapProps {
    pet: Pet;
    initialCenter: { lat: number; lng: number };
    initialZoom: number;
    recommendations: MapRecommendation[];
    mode: MapMode | null;
    hoveredId: number | null;
    focus: FocusRequest | null;
    status: ReactNode;
    onViewportChange: (viewport: Viewport) => void;
    onHover: (id: number | null) => void;
    onSelect: (id: number) => void;
    onShowReviews: (item: MapRecommendation) => void;
}

export function RecommendationMap({
    pet,
    initialCenter,
    initialZoom,
    recommendations,
    mode,
    hoveredId,
    focus,
    status,
    onViewportChange,
    onHover,
    onSelect,
    onShowReviews,
}: RecommendationMapProps) {
    const [map, setMap] = useState<L.Map | null>(null);
    const markers = useRef(new Map<number, L.Marker>());
    const [locating, setLocating] = useState(false);
    const [locationNote, setLocationNote] = useState('');

    // "Show on map" from the list: bring the pin into view and open it.
    useEffect(() => {
        if (!map || !focus) return;
        const marker = markers.current.get(focus.id);
        if (!marker) return;
        map.panTo(marker.getLatLng());
        marker.openPopup();
    }, [map, focus]);

    const registerMarker = useCallback(
        (id: number, marker: L.Marker | null) => {
            if (marker) markers.current.set(id, marker);
            else markers.current.delete(id);
        },
        [],
    );

    const pins = useMemo(
        () =>
            recommendations.map((item, index) => ({
                item,
                rank: mode === 'top' ? index + 1 : undefined,
            })),
        [recommendations, mode],
    );

    function locateMe() {
        if (!map) return;
        if (!('geolocation' in navigator)) {
            setLocationNote('Your browser can’t share its location.');
            return;
        }
        setLocating(true);
        setLocationNote('');
        navigator.geolocation.getCurrentPosition(
            (position) => {
                setLocating(false);
                map.flyTo(
                    [position.coords.latitude, position.coords.longitude],
                    DEFAULT_ZOOM,
                );
            },
            (error) => {
                setLocating(false);
                setLocationNote(
                    error.code === error.PERMISSION_DENIED
                        ? 'Location access was denied, so the map stays where it is.'
                        : 'Couldn’t find your location. Try again or pan the map.',
                );
            },
            { timeout: 10000, maximumAge: 60000 },
        );
    }

    const controlClass =
        'flex min-h-10 items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 text-sm font-semibold text-gray-800 shadow-sm hover:bg-gray-50 disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700';

    return (
        <div className="relative isolate h-[60vh] min-h-[360px] overflow-hidden rounded-2xl border border-gray-200 lg:h-[calc(100vh-2rem)] lg:max-h-[720px]">
            <MapContainer
                ref={setMap}
                center={[initialCenter.lat, initialCenter.lng]}
                zoom={initialZoom}
                minZoom={MIN_ZOOM}
                maxZoom={MAX_ZOOM}
                zoomControl={false}
                className="h-full w-full"
            >
                <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <ZoomControl position="bottomright" />
                <ViewportWatcher onChange={onViewportChange} />

                <Marker
                    position={[CHULA.lat, CHULA.lng]}
                    icon={CAMPUS_ICON}
                    title="Chulalongkorn University"
                    alt="Chulalongkorn University"
                    zIndexOffset={-100}
                >
                    <Popup>
                        <strong>Chulalongkorn University</strong>
                        <br />
                        Pathum Wan, Bangkok
                    </Popup>
                </Marker>

                {pins.map(({ item, rank }) => (
                    <ServicePin
                        key={item.service.id}
                        item={item}
                        rank={rank}
                        pet={pet}
                        highlighted={item.service.id === hoveredId}
                        registerMarker={registerMarker}
                        onHover={onHover}
                        onSelect={onSelect}
                        onShowReviews={onShowReviews}
                    />
                ))}
            </MapContainer>

            <div className="pointer-events-none absolute inset-x-3 top-3 z-[1000] flex flex-wrap items-start justify-between gap-2">
                <div className="pointer-events-auto">{status}</div>
                <div className="pointer-events-auto flex flex-wrap justify-end gap-2">
                    <button
                        type="button"
                        className={controlClass}
                        onClick={() => map?.flyTo([CHULA.lat, CHULA.lng], DEFAULT_ZOOM)}
                    >
                        <i aria-hidden="true" className="fa-solid fa-building-columns text-pink-700"></i>
                        Recenter on Chula
                    </button>
                    <button
                        type="button"
                        className={controlClass}
                        onClick={locateMe}
                        disabled={locating}
                    >
                        <i aria-hidden="true" className="fa-solid fa-location-crosshairs text-teal-700"></i>
                        {locating ? 'Locating...' : 'Use my location'}
                    </button>
                </div>
            </div>
            {locationNote && (
                <p
                    role="status"
                    className="absolute inset-x-3 bottom-3 z-[1000] m-0 mr-14 rounded-lg bg-white/95 p-2 text-sm text-gray-800 shadow"
                >
                    {locationNote}
                </p>
            )}
        </div>
    );
}

interface ServicePinProps {
    item: MapRecommendation;
    rank: number | undefined;
    pet: Pet;
    highlighted: boolean;
    registerMarker: (id: number, marker: L.Marker | null) => void;
    onHover: (id: number | null) => void;
    onSelect: (id: number) => void;
    onShowReviews: (item: MapRecommendation) => void;
}

function ServicePin({
    item,
    rank,
    pet,
    highlighted,
    registerMarker,
    onHover,
    onSelect,
    onShowReviews,
}: ServicePinProps) {
    const { service, score, matchedNeeds, averageRating, reviewCount } = item;
    const icon = useMemo(
        () => pinIcon(item, rank, highlighted),
        [item, rank, highlighted],
    );
    const id = service.id;

    return (
        <Marker
            ref={(marker) => registerMarker(id, marker)}
            position={[service.location.lat, service.location.lng]}
            icon={icon}
            title={`${rank !== undefined ? `${rank}. ` : ''}${service.title}`}
            alt={service.title}
            // Better ranks draw on top where pins overlap.
            zIndexOffset={
                highlighted
                    ? 1000
                    : rank !== undefined
                      ? 500 - rank * 10
                      : item.matched
                        ? 100
                        : 0
            }
            eventHandlers={{
                mouseover: () => onHover(id),
                mouseout: () => onHover(null),
                click: () => onSelect(id),
            }}
        >
            <Popup>
                <div className="min-w-[220px] max-w-[260px] text-sm">
                    <div className="m-0 text-xs font-semibold uppercase tracking-wide text-teal-700">
                        {rank !== undefined && `#${rank} · `}
                        {service.category}
                    </div>
                    <div className="m-0 mt-1 text-base font-bold leading-snug text-gray-900">
                        {service.title}
                    </div>
                    <div className="m-0 text-gray-600">
                        By {service.provider} · <strong className="text-gray-900">${service.price}</strong>
                    </div>
                    <div className="mt-2">
                        <RatingSummary
                            averageRating={averageRating}
                            reviewCount={reviewCount}
                        />
                    </div>
                    {item.matched && pet.needs.length > 0 ? (
                        <div className="m-0 mt-2 text-gray-800">
                            <span className="font-semibold">
                                {matchLabel(score)} ({Math.round(score * 100)}%)
                            </span>
                            {matchedNeeds.length > 0 && (
                                <span className="block capitalize text-teal-900">
                                    <i aria-hidden="true" className="fa-solid fa-circle-check mr-1 text-teal-600"></i>
                                    {matchedNeeds.map(readableTag).join(', ')}
                                </span>
                            )}
                        </div>
                    ) : (
                        !item.matched && (
                            <div className="m-0 mt-2 text-gray-600">
                                Doesn’t cover {pet.name}’s needs.
                            </div>
                        )
                    )}
                    <div className="m-0 mt-2 text-gray-600">
                        <i aria-hidden="true" className="fa-solid fa-location-dot mr-1 text-gray-400"></i>
                        {service.location.address}
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                        <button
                            type="button"
                            onClick={() => onSelect(id)}
                            className="min-h-9 rounded-lg bg-teal-700 px-3 text-sm font-semibold text-white hover:bg-teal-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
                        >
                            Details
                        </button>
                        {reviewCount > 0 && (
                            <button
                                type="button"
                                onClick={() => onShowReviews(item)}
                                className="min-h-9 rounded-lg border border-gray-300 bg-white px-3 text-sm font-semibold text-gray-800 hover:bg-gray-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
                            >
                                Reviews
                            </button>
                        )}
                    </div>
                </div>
            </Popup>
        </Marker>
    );
}
