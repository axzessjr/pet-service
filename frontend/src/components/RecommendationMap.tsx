import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
    MapContainer,
    Marker,
    Popup,
    TileLayer,
    useMap,
    useMapEvents,
} from 'react-leaflet';
import type { MapBounds, MapMode, MapRecommendation } from '../types';
import {
    barelyChanged,
    CHULA,
    DEBOUNCE_MS,
    DEFAULT_ZOOM,
    MAX_ZOOM,
    MIN_ZOOM,
    type Viewport,
} from '../mapApi';
import { categoryColor, categoryIcon, formatPrice, matchLabel, UNMATCHED_COLOR } from './ui';

// OpenStreetMap tiles, slightly softened so the coloured pins still stand out.
const TILES = {
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    className: 'saturate-[.8]',
};

const CAMPUS_ICON = L.divIcon({
    className: '',
    html: `<span class="flex h-9 w-9 items-center justify-center rounded-full border-[3px] border-white bg-pink-700 text-sm text-snow shadow-lg"><i class="fa-solid fa-building-columns"></i></span>`,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
    popupAnchor: [0, -18],
});

const YOU_ARE_HERE_ICON = L.divIcon({
    className: '',
    html: `<span class="relative flex h-5 w-5"><span class="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-400 opacity-60 motion-reduce:animate-none"></span><span class="relative inline-flex h-5 w-5 rounded-full border-[3px] border-white bg-blue-600 shadow"></span></span>`,
    iconSize: [20, 20],
    iconAnchor: [10, 10],
});

type PinState = 'normal' | 'hovered' | 'selected';

function pinIcon(
    item: MapRecommendation,
    rank: number | undefined,
    state: PinState,
    best: boolean,
): L.DivIcon {
    const color = item.matched
        ? categoryColor(item.service.category)
        : UNMATCHED_COLOR;
    const base = item.matched ? 32 : 26;
    const size = state === 'selected' ? 44 : state === 'hovered' ? base + 6 : base;
    const label =
        rank !== undefined
            ? `<span class="text-sm font-bold">${rank}</span>`
            : `<i class="fa-solid ${categoryIcon(item.service.category)} ${size >= 40 ? 'text-base' : 'text-xs'}"></i>`;
    const ring =
        state === 'selected'
            ? 'ring-4 ring-amber-400 shadow-xl'
            : state === 'hovered'
              ? 'ring-4 ring-amber-300 shadow-lg'
              : 'shadow-md';
    const star = best
        ? `<span class="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full border border-white bg-amber-400 text-[9px] text-amber-950"><i class="fa-solid fa-star"></i></span>`
        : '';
    return L.divIcon({
        className: '',
        html: `<span class="relative flex items-center justify-center rounded-full border-2 border-white text-snow transition-transform ${ring}" style="width:${size}px;height:${size}px;background:${color}">${label}${star}</span>`,
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2],
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

// Leaflet only measures its box on load; this keeps it right when the
// layout around it changes, such as when the filters open.
function SizeWatcher() {
    const map = useMap();
    useEffect(() => {
        const observer = new ResizeObserver(() => map.invalidateSize());
        observer.observe(map.getContainer());
        return () => observer.disconnect();
    }, [map]);
    return null;
}

function BackgroundClick({ onClick }: { onClick: () => void }) {
    useMapEvents({ click: onClick });
    return null;
}

// Holds the map to the area with services: it can't be dragged off it, or
// zoomed out past the point where all of it is in view. The second limit
// depends on the map's size, so it is worked out again on resize.
function AreaLimit({ area }: { area: L.LatLngBounds | null }) {
    const map = useMap();
    useEffect(() => {
        if (!area) return;
        const fitZoom = () =>
            map.setMinZoom(Math.max(MIN_ZOOM, map.getBoundsZoom(area)));
        map.setMaxBounds(area);
        fitZoom();
        map.on('resize', fitZoom);
        return () => {
            map.off('resize', fitZoom);
        };
    }, [map, area]);
    return null;
}

interface RecommendationMapProps {
    initialCenter: { lat: number; lng: number };
    initialZoom: number;
    // Where the services are; the map stays inside it once it is known.
    area: MapBounds | null;
    recommendations: MapRecommendation[];
    // The open service, if the map has moved so it is no longer in the
    // results, so its pin stays put.
    extraPin: MapRecommendation | null;
    mode: MapMode | null;
    hoveredId: number | null;
    selectedId: number | null;
    bestId: number | null;
    overlay: ReactNode;
    onReady: (map: L.Map) => void;
    onViewportChange: (viewport: Viewport) => void;
    onHover: (id: number | null) => void;
    onSelect: (item: MapRecommendation) => void;
    onBackgroundClick: () => void;
}

export function RecommendationMap({
    initialCenter,
    initialZoom,
    area,
    recommendations,
    extraPin,
    mode,
    hoveredId,
    selectedId,
    bestId,
    overlay,
    onReady,
    onViewportChange,
    onHover,
    onSelect,
    onBackgroundClick,
}: RecommendationMapProps) {
    const [map, setMap] = useState<L.Map | null>(null);
    const [locating, setLocating] = useState(false);
    const [locationNote, setLocationNote] = useState('');
    const [here, setHere] = useState<{ lat: number; lng: number } | null>(null);
    // For greying out the zoom buttons at the limits.
    const [zoom, setZoom] = useState({
        level: initialZoom,
        min: MIN_ZOOM,
        max: MAX_ZOOM,
    });
    const areaBounds = useMemo(
        () =>
            area
                ? L.latLngBounds(
                      [area.minLat, area.minLng],
                      [area.maxLat, area.maxLng],
                  )
                : null,
        [area],
    );

    useEffect(() => {
        if (map) onReady(map);
    }, [map, onReady]);

    useEffect(() => {
        if (!map) return;
        const update = () =>
            setZoom({
                level: map.getZoom(),
                min: map.getMinZoom(),
                max: map.getMaxZoom(),
            });
        map.on('zoomend zoomlevelschange', update);
        return () => {
            map.off('zoomend zoomlevelschange', update);
        };
    }, [map]);

    const pins = useMemo(() => {
        const list = recommendations.map((item, index) => ({
            item,
            rank: mode === 'top' ? index + 1 : undefined,
        }));
        if (extraPin) list.push({ item: extraPin, rank: undefined });
        return list;
    }, [recommendations, extraPin, mode]);

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
                const point = {
                    lat: position.coords.latitude,
                    lng: position.coords.longitude,
                };
                // The map can't go there, so say so rather than bounce back.
                if (areaBounds && !areaBounds.contains([point.lat, point.lng])) {
                    setLocationNote(
                        'You’re outside the area with services, so the map stays here.',
                    );
                    return;
                }
                setHere(point);
                map.flyTo([point.lat, point.lng], DEFAULT_ZOOM);
            },
            (error) => {
                setLocating(false);
                setLocationNote(
                    error.code === error.PERMISSION_DENIED
                        ? 'Location access was denied, so the map stays where it is.'
                        : 'Couldn’t find your location. Try again or move the map.',
                );
            },
            { timeout: 10000, maximumAge: 60000 },
        );
    }

    const controlClass =
        'flex h-11 w-11 items-center justify-center bg-white text-gray-800 hover:bg-gray-50 disabled:opacity-50 focus-visible:relative focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700';
    const groupClass =
        'flex flex-col divide-y divide-gray-200 overflow-hidden rounded-lg shadow-md ring-1 ring-black/10';

    return (
        <div className="relative isolate h-full w-full">
            <MapContainer
                ref={setMap}
                center={[initialCenter.lat, initialCenter.lng]}
                zoom={initialZoom}
                minZoom={MIN_ZOOM}
                maxZoom={MAX_ZOOM}
                // A hard edge at the area limit, rather than a rubber band.
                maxBoundsViscosity={1}
                zoomControl={false}
                className="h-full w-full bg-gray-100"
            >
                <TileLayer {...TILES} />
                <ViewportWatcher onChange={onViewportChange} />
                <SizeWatcher />
                <AreaLimit area={areaBounds} />
                <BackgroundClick onClick={onBackgroundClick} />

                <Marker
                    position={[CHULA.lat, CHULA.lng]}
                    icon={CAMPUS_ICON}
                    title="Chulalongkorn University"
                    zIndexOffset={-100}
                >
                    <Popup>
                        <strong>Chulalongkorn University</strong>
                        <br />
                        Pathum Wan, Bangkok
                    </Popup>
                </Marker>

                {here && (
                    <Marker
                        position={[here.lat, here.lng]}
                        icon={YOU_ARE_HERE_ICON}
                        interactive={false}
                        keyboard={false}
                        zIndexOffset={-50}
                    />
                )}

                {pins.map(({ item, rank }) => (
                    <ServicePin
                        key={item.service.id}
                        item={item}
                        rank={rank}
                        state={
                            item.service.id === selectedId
                                ? 'selected'
                                : item.service.id === hoveredId
                                  ? 'hovered'
                                  : 'normal'
                        }
                        best={item.service.id === bestId}
                        onHover={onHover}
                        onSelect={onSelect}
                    />
                ))}
            </MapContainer>

            <div className="pointer-events-none absolute inset-x-16 top-3 z-[1000] flex flex-col items-center gap-2">
                <div className="pointer-events-auto">{overlay}</div>
                {locationNote && (
                    <p
                        role="status"
                        className="pointer-events-auto m-0 max-w-xs rounded-lg bg-white/95 px-3 py-2 text-center text-sm text-gray-800 shadow-md ring-1 ring-black/10"
                    >
                        {locationNote}
                    </p>
                )}
            </div>

            <div className="absolute right-3 top-3 z-[1000] flex flex-col gap-2">
                {/* Phones zoom with a pinch, which leaves room for the sheet. */}
                <div className={`${groupClass} max-lg:hidden`}>
                    <button
                        type="button"
                        aria-label="Zoom in"
                        title="Zoom in"
                        onClick={() => map?.zoomIn()}
                        disabled={zoom.level >= zoom.max}
                        className={controlClass}
                    >
                        <i aria-hidden="true" className="fa-solid fa-plus"></i>
                    </button>
                    <button
                        type="button"
                        aria-label="Zoom out"
                        title={zoom.level <= zoom.min ? 'The whole area with services is in view' : 'Zoom out'}
                        onClick={() => map?.zoomOut()}
                        disabled={zoom.level <= zoom.min}
                        className={controlClass}
                    >
                        <i aria-hidden="true" className="fa-solid fa-minus"></i>
                    </button>
                </div>
                <div className={groupClass}>
                    <button
                        type="button"
                        aria-label={locating ? 'Finding your location' : 'Show my location'}
                        title="Show my location"
                        onClick={locateMe}
                        disabled={locating}
                        className={controlClass}
                    >
                        <i aria-hidden="true" className={`fa-solid ${locating ? 'fa-spinner fa-spin' : 'fa-location-crosshairs'} text-blue-700`}></i>
                    </button>
                    <button
                        type="button"
                        aria-label="Back to Chulalongkorn University"
                        title="Back to Chulalongkorn University"
                        onClick={() => map?.flyTo([CHULA.lat, CHULA.lng], DEFAULT_ZOOM)}
                        className={controlClass}
                    >
                        <i aria-hidden="true" className="fa-solid fa-building-columns text-pink-700"></i>
                    </button>
                </div>
            </div>
        </div>
    );
}

interface ServicePinProps {
    item: MapRecommendation;
    rank: number | undefined;
    state: PinState;
    best: boolean;
    onHover: (id: number | null) => void;
    onSelect: (item: MapRecommendation) => void;
}

function ServicePin({ item, rank, state, best, onHover, onSelect }: ServicePinProps) {
    const { service, score, matched } = item;
    const icon = useMemo(
        () => pinIcon(item, rank, state, best),
        [item, rank, state, best],
    );
    const id = service.id;
    const summary = matched ? matchLabel(score) : 'Doesn’t cover the needs';

    return (
        <Marker
            position={[service.location.lat, service.location.lng]}
            icon={icon}
            title={`${rank !== undefined ? `${rank}. ` : ''}${service.title}, ${formatPrice(service.price)}, ${summary}`}
            // The open pin, then the hovered one, then better ranks draw on
            // top where pins overlap.
            zIndexOffset={
                state === 'selected'
                    ? 2000
                    : state === 'hovered'
                      ? 1500
                      : rank !== undefined
                        ? 500 - rank * 10
                        : matched
                          ? 100
                          : 0
            }
            eventHandlers={{
                mouseover: () => onHover(id),
                mouseout: () => onHover(null),
                click: () => onSelect(item),
            }}
        />
    );
}
