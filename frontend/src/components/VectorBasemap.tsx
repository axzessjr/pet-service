import { useEffect, useRef, useState } from 'react';
import type L from 'leaflet';
import { MaplibreGL } from '@maplibre/maplibre-gl-leaflet';
import { setWorkerUrl, type ErrorEvent as VectorError, type Map as VectorMap } from 'maplibre-gl';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import 'maplibre-gl/dist/maplibre-gl.css';
import { TileLayer, useMap } from 'react-leaflet';
import { loadMapStyle, type MapStyle } from '../mapStyles';

setWorkerUrl(workerUrl);

export type BasemapStatus = 'loading' | 'ready' | 'fallback';

const ATTRIBUTION =
    '<a href="https://openfreemap.org/">OpenFreeMap</a> &copy; <a href="https://openmaptiles.org/">OpenMapTiles</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

// The adapter assumes WebGL initialized successfully when removing its layer.
// Allow cleanup even when the browser cannot create a WebGL context.
class BasemapLayer extends MaplibreGL {
    onRemove(map: L.Map): this {
        if (this.getMaplibreMap()) super.onRemove(map);
        else this.getContainer()?.remove();
        return this;
    }
}

export function VectorBasemap({
    mapStyle,
    onStatus,
}: {
    mapStyle: MapStyle;
    onStatus: (status: BasemapStatus) => void;
}) {
    const map = useMap();
    const layerRef = useRef<BasemapLayer | null>(null);
    const [fallback, setFallback] = useState(false);

    useEffect(() => () => {
        layerRef.current?.remove();
        layerRef.current = null;
    }, [map]);

    useEffect(() => {
        const controller = new AbortController();
        let cancelled = false;
        let vectorMap: VectorMap | undefined;
        let tileFailed = false;

        const ready = () => {
            if (cancelled || !vectorMap?.isStyleLoaded()
                || !vectorMap.getSource('openmaptiles')
                || !vectorMap.isSourceLoaded('openmaptiles')) return;
            if (tileFailed && vectorMap.queryRenderedFeatures().length === 0) {
                fail();
                return;
            }
            window.clearTimeout(timeout);
            vectorMap.off('render', ready);
            setFallback(false);
            onStatus('ready');
        };
        const fail = () => {
            if (cancelled) return;
            cancelled = true;
            controller.abort();
            window.clearTimeout(timeout);
            vectorMap?.off('render', ready);
            vectorMap?.off('error', onError);
            vectorMap?.off('webglcontextlost', fail);
            layerRef.current?.remove();
            layerRef.current = null;
            setFallback(true);
            onStatus('fallback');
        };
        const onError = (event: VectorError) => {
            if ('tile' in event) {
                // One failed tile shouldn't replace an otherwise usable map.
                tileFailed = true;
            } else if ('sourceId' in event && event.sourceId === 'openmaptiles') {
                fail();
            }
        };

        const timeout = window.setTimeout(fail, 20000);
        loadMapStyle(mapStyle, controller.signal)
            .then((style) => {
                if (cancelled) return;
                if (!layerRef.current) {
                    layerRef.current = new BasemapLayer({
                        style,
                        attributionControl: { customAttribution: ATTRIBUTION },
                        interactive: false,
                    });
                    layerRef.current.addTo(map);
                } else {
                    layerRef.current.getMaplibreMap().setStyle(style);
                }
                vectorMap = layerRef.current.getMaplibreMap();
                vectorMap.on('render', ready);
                vectorMap.on('error', onError);
                vectorMap.on('webglcontextlost', fail);
                // Leaflet owns keyboard and pointer interactions, including pins.
                vectorMap.getCanvas().setAttribute('tabindex', '-1');
                vectorMap.getCanvas().setAttribute('aria-hidden', 'true');
            })
            .catch(fail);

        return () => {
            cancelled = true;
            controller.abort();
            window.clearTimeout(timeout);
            vectorMap?.off('render', ready);
            vectorMap?.off('error', onError);
            vectorMap?.off('webglcontextlost', fail);
        };
    }, [map, mapStyle, onStatus]);

    return fallback ? (
        <TileLayer
            url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />
    ) : null;
}
