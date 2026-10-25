import { BadRequestException } from '@nestjs/common';
import { matchesCategory, matchesText } from '../catalog/catalog.service';
import { CatalogItem } from '../catalog/catalog.types';
import {
    MapBounds,
    MapMode,
    MapRecommendation,
    OverBudget,
} from './recommendation.types';

// How the map decides what to show. At DETAIL_ZOOM and closer, every ranked
// service in view is returned (up to DETAIL_LIMIT). Further out, only the
// best TOP_N are, so a city-wide view is not covered in pins.
export const MAP_LIMITS = {
    DETAIL_ZOOM: 15,
    DETAIL_LIMIT: 50,
    TOP_N: 10,
    // Larger boxes than this (in degrees) are refused; at zoom 11 a wide
    // screen spans about 1.3 degrees of longitude.
    MAX_SPAN_DEGREES: 2,
    MAX_ZOOM: 22,
    MAX_TEXT_LENGTH: 100,
} as const;

export interface MapQuery {
    bounds: MapBounds;
    zoom: number;
    q?: string;
    category?: string;
    maxPrice?: number;
    minRating?: number;
    limit?: number;
    includeUnmatched: boolean;
}

const DECIMAL = /^-?\d+(\.\d+)?$/;
const INTEGER = /^\d+$/;

function text(raw: Record<string, unknown>, name: string): string | undefined {
    const value = raw[name];
    if (value === undefined) return undefined;
    if (typeof value !== 'string') {
        throw new BadRequestException(`${name} must be given once`);
    }
    return value;
}

function decimal(
    raw: Record<string, unknown>,
    name: string,
    min: number,
    max: number,
): number | undefined {
    const value = text(raw, name);
    if (value === undefined) return undefined;
    const parsed = Number(value);
    if (!DECIMAL.test(value) || parsed < min || parsed > max) {
        throw new BadRequestException(
            `${name} must be a number from ${min} to ${max}`,
        );
    }
    return parsed;
}

function integer(
    raw: Record<string, unknown>,
    name: string,
    min: number,
    max: number,
): number | undefined {
    const value = text(raw, name);
    if (value === undefined) return undefined;
    const parsed = Number(value);
    if (!INTEGER.test(value) || parsed < min || parsed > max) {
        throw new BadRequestException(
            `${name} must be a whole number from ${min} to ${max}`,
        );
    }
    return parsed;
}

function required<T>(name: string, value: T | undefined): T {
    if (value === undefined) {
        throw new BadRequestException(`${name} is required`);
    }
    return value;
}

function searchText(
    raw: Record<string, unknown>,
    name: string,
): string | undefined {
    const value = text(raw, name)?.trim();
    if (value === undefined || value === '') return undefined;
    if (value.length > MAP_LIMITS.MAX_TEXT_LENGTH) {
        throw new BadRequestException(
            `${name} must be at most ${MAP_LIMITS.MAX_TEXT_LENGTH} characters`,
        );
    }
    return value;
}

export function parseBounds(raw: Record<string, unknown>): MapBounds {
    const bounds = {
        minLat: required('minLat', decimal(raw, 'minLat', -90, 90)),
        minLng: required('minLng', decimal(raw, 'minLng', -180, 180)),
        maxLat: required('maxLat', decimal(raw, 'maxLat', -90, 90)),
        maxLng: required('maxLng', decimal(raw, 'maxLng', -180, 180)),
    };
    if (bounds.minLat >= bounds.maxLat || bounds.minLng >= bounds.maxLng) {
        throw new BadRequestException(
            'minLat and minLng must be less than maxLat and maxLng',
        );
    }
    if (
        bounds.maxLat - bounds.minLat > MAP_LIMITS.MAX_SPAN_DEGREES ||
        bounds.maxLng - bounds.minLng > MAP_LIMITS.MAX_SPAN_DEGREES
    ) {
        throw new BadRequestException(
            `The map area may span at most ${MAP_LIMITS.MAX_SPAN_DEGREES} degrees; zoom in`,
        );
    }
    return bounds;
}

export function parseMapQuery(raw: Record<string, unknown>): MapQuery {
    const includeUnmatched = text(raw, 'includeUnmatched');
    if (
        includeUnmatched !== undefined &&
        !['true', 'false', '1', '0'].includes(includeUnmatched)
    ) {
        throw new BadRequestException('includeUnmatched must be true or false');
    }
    return {
        bounds: parseBounds(raw),
        zoom: required('zoom', integer(raw, 'zoom', 0, MAP_LIMITS.MAX_ZOOM)),
        q: searchText(raw, 'q'),
        category: searchText(raw, 'category'),
        maxPrice: decimal(raw, 'maxPrice', 0.01, 1_000_000),
        minRating: decimal(raw, 'minRating', 0, 5),
        limit: integer(raw, 'limit', 1, MAP_LIMITS.DETAIL_LIMIT),
        includeUnmatched:
            includeUnmatched === 'true' || includeUnmatched === '1',
    };
}

export function inBounds(item: CatalogItem, bounds: MapBounds): boolean {
    const { lat, lng } = item.location;
    return (
        lat >= bounds.minLat &&
        lat <= bounds.maxLat &&
        lng >= bounds.minLng &&
        lng <= bounds.maxLng
    );
}

// A pet's maxPrice of 0 means no limit. The query can only lower the limit.
export function effectiveMaxPrice(
    petMaxPrice: number,
    queryMaxPrice?: number,
): number {
    if (queryMaxPrice === undefined) return petMaxPrice;
    return petMaxPrice > 0
        ? Math.min(petMaxPrice, queryMaxPrice)
        : queryMaxPrice;
}

// Everything that can be decided before ranking. Ratings come back from the
// recommender with the matches, so minRating is applied afterwards.
export function filterForMap(
    items: CatalogItem[],
    query: Pick<MapQuery, 'bounds' | 'q' | 'category'>,
    maxPrice: number,
): CatalogItem[] {
    return items.filter(
        (item) =>
            inBounds(item, query.bounds) &&
            (query.q === undefined || matchesText(item, query.q)) &&
            (query.category === undefined ||
                matchesCategory(item, query.category)) &&
            (maxPrice <= 0 || item.price <= maxPrice),
    );
}

// The services that would show but for the price limit: in view, passing the
// search filters, and for the pet's species. Lets the page say when the
// budget alone hides everything, instead of suggesting a wider search.
export function overBudget(
    items: CatalogItem[],
    query: Pick<MapQuery, 'bounds' | 'q' | 'category'>,
    maxPrice: number,
    species: string,
): OverBudget | undefined {
    if (maxPrice <= 0) return undefined;
    const wanted = species.trim().toLowerCase();
    const prices = filterForMap(items, query, 0)
        .filter(
            (item) =>
                item.price > maxPrice &&
                item.species.some((value) => value.toLowerCase() === wanted),
        )
        .map((item) => item.price);
    if (prices.length === 0) return undefined;
    return {
        count: prices.length,
        cheapestPrice: Math.min(...prices),
        maxPrice,
    };
}

export function mapMode(zoom: number): MapMode {
    return zoom >= MAP_LIMITS.DETAIL_ZOOM ? 'detail' : 'top';
}

// `ranked` is already in recommendation order: matched services by score,
// then rating, then the unmatched ones.
export function cutForZoom(
    ranked: MapRecommendation[],
    zoom: number,
    limit?: number,
): { mode: MapMode; recommendations: MapRecommendation[] } {
    const mode = mapMode(zoom);
    const cap = mode === 'detail' ? MAP_LIMITS.DETAIL_LIMIT : MAP_LIMITS.TOP_N;
    return {
        mode,
        recommendations: ranked.slice(0, Math.min(limit ?? cap, cap)),
    };
}
