import { BadRequestException } from '@nestjs/common';
import { CatalogItem } from '../catalog/catalog.types';
import {
    cutForZoom,
    effectiveMaxPrice,
    filterForMap,
    inBounds,
    MAP_LIMITS,
    mapMode,
    parseBounds,
    parseMapQuery,
} from './map';
import { MapRecommendation } from './recommendation.types';

const CHULA_VIEW = {
    minLat: '13.73',
    minLng: '100.52',
    maxLat: '13.75',
    maxLng: '100.54',
};

function item(
    id: number,
    lat: number,
    lng: number,
    overrides: Partial<CatalogItem> = {},
): CatalogItem {
    return {
        id,
        title: `Service ${id}`,
        provider: 'Provider',
        price: 20,
        category: 'Walking',
        species: ['dog'],
        tags: ['exercise'],
        description: 'A service.',
        location: { lat, lng, address: 'Somewhere', district: 'Samyan' },
        ...overrides,
    };
}

function ranked(count: number): MapRecommendation[] {
    return Array.from({ length: count }, (_, index) => ({
        service: item(index + 1, 13.74, 100.53),
        score: 1 - index / 100,
        matchedNeeds: ['exercise'],
        averageRating: 0,
        reviewCount: 0,
        matched: true,
    }));
}

describe('map bounds validation', () => {
    it('parses valid bounds', () => {
        expect(parseBounds(CHULA_VIEW)).toEqual({
            minLat: 13.73,
            minLng: 100.52,
            maxLat: 13.75,
            maxLng: 100.54,
        });
    });

    it.each(['minLat', 'minLng', 'maxLat', 'maxLng'])('requires %s', (name) => {
        const raw: Record<string, unknown> = { ...CHULA_VIEW };
        delete raw[name];
        expect(() => parseBounds(raw)).toThrow(`${name} is required`);
    });

    it.each(['', 'abc', '1e2', 'Infinity', '13.7.1', ' 13'])(
        'rejects non-numeric value %p',
        (value) => {
            expect(() => parseBounds({ ...CHULA_VIEW, minLat: value })).toThrow(
                BadRequestException,
            );
        },
    );

    it('rejects repeated params', () => {
        expect(() =>
            parseBounds({ ...CHULA_VIEW, minLat: ['13.7', '13.8'] }),
        ).toThrow('minLat must be given once');
    });

    it('rejects coordinates outside the globe', () => {
        expect(() => parseBounds({ ...CHULA_VIEW, maxLat: '91' })).toThrow(
            BadRequestException,
        );
        expect(() => parseBounds({ ...CHULA_VIEW, minLng: '-181' })).toThrow(
            BadRequestException,
        );
    });

    it('requires min to be less than max', () => {
        expect(() =>
            parseBounds({ ...CHULA_VIEW, minLat: '13.75', maxLat: '13.73' }),
        ).toThrow('must be less than');
        expect(() => parseBounds({ ...CHULA_VIEW, minLng: '100.54' })).toThrow(
            'must be less than',
        );
    });

    it('rejects absurdly large boxes', () => {
        expect(() =>
            parseBounds({ ...CHULA_VIEW, minLat: '10', maxLat: '15' }),
        ).toThrow('zoom in');
        expect(() =>
            parseBounds({ ...CHULA_VIEW, minLng: '-180', maxLng: '180' }),
        ).toThrow('zoom in');
    });
});

describe('parseMapQuery', () => {
    it('parses zoom and optional filters', () => {
        expect(
            parseMapQuery({
                ...CHULA_VIEW,
                zoom: '14',
                q: '  groom ',
                category: 'Grooming',
                maxPrice: '40',
                minRating: '4.5',
                limit: '5',
                includeUnmatched: 'true',
            }),
        ).toEqual({
            bounds: parseBounds(CHULA_VIEW),
            zoom: 14,
            q: 'groom',
            category: 'Grooming',
            maxPrice: 40,
            minRating: 4.5,
            limit: 5,
            includeUnmatched: true,
        });
    });

    it('treats blank text filters as absent', () => {
        expect(
            parseMapQuery({ ...CHULA_VIEW, zoom: '15', q: ' ', category: '' }),
        ).toMatchObject({ q: undefined, category: undefined });
    });

    it.each([
        [{ zoom: undefined }, 'zoom is required'],
        [{ zoom: '14.5' }, 'zoom must be a whole number'],
        [{ zoom: '23' }, 'zoom must be a whole number'],
        [{ maxPrice: '0' }, 'maxPrice must be a number'],
        [{ maxPrice: '-5' }, 'maxPrice must be a number'],
        [{ minRating: '6' }, 'minRating must be a number'],
        [{ limit: '0' }, 'limit must be a whole number'],
        [{ limit: '51' }, 'limit must be a whole number'],
        [{ q: 'x'.repeat(101) }, 'q must be at most'],
        [{ includeUnmatched: 'yes' }, 'includeUnmatched must be true or false'],
    ])('rejects %p', (overrides, message) => {
        const raw: Record<string, unknown> = {
            ...CHULA_VIEW,
            zoom: '15',
            ...overrides,
        };
        expect(() => parseMapQuery(raw)).toThrow(message);
    });
});

describe('inBounds', () => {
    const bounds = parseBounds(CHULA_VIEW);

    it('includes points inside and on the edge', () => {
        expect(inBounds(item(1, 13.74, 100.53), bounds)).toBe(true);
        expect(inBounds(item(2, 13.73, 100.54), bounds)).toBe(true);
    });

    it('excludes points outside', () => {
        expect(inBounds(item(3, 13.7299, 100.53), bounds)).toBe(false);
        expect(inBounds(item(4, 13.74, 100.5401), bounds)).toBe(false);
        // Silom, south of the Chula view.
        expect(inBounds(item(5, 13.7258, 100.5296), bounds)).toBe(false);
    });
});

describe('filterForMap', () => {
    const bounds = parseBounds(CHULA_VIEW);
    const items = [
        item(1, 13.74, 100.53, {
            title: 'Dog Grooming Deluxe',
            category: 'Grooming',
            price: 60,
        }),
        item(2, 13.741, 100.531, { category: 'Walking', price: 15 }),
        item(3, 13.742, 100.532, {
            category: 'Grooming',
            price: 30,
            location: {
                lat: 13.742,
                lng: 100.532,
                address: 'Soi Chula 42',
                district: 'Samyan',
            },
        }),
        // Outside the view.
        item(4, 13.72, 100.53, { title: 'Far Grooming', category: 'Grooming' }),
    ];
    const ids = (list: CatalogItem[]) => list.map((entry) => entry.id);

    it('keeps only services in bounds', () => {
        expect(ids(filterForMap(items, { bounds }, 0))).toEqual([1, 2, 3]);
    });

    it('filters by text', () => {
        expect(ids(filterForMap(items, { bounds, q: 'GROOM' }, 0))).toEqual([
            1, 3,
        ]);
        expect(ids(filterForMap(items, { bounds, q: 'soi chula' }, 0))).toEqual(
            [3],
        );
    });

    it('filters by category', () => {
        expect(
            ids(filterForMap(items, { bounds, category: 'walking' }, 0)),
        ).toEqual([2]);
    });

    it('filters by price, where 0 means no limit', () => {
        expect(ids(filterForMap(items, { bounds }, 30))).toEqual([2, 3]);
        expect(ids(filterForMap(items, { bounds }, 0))).toEqual([1, 2, 3]);
    });
});

describe('effectiveMaxPrice', () => {
    it('only narrows the pet budget', () => {
        expect(effectiveMaxPrice(50, undefined)).toBe(50);
        expect(effectiveMaxPrice(50, 30)).toBe(30);
        expect(effectiveMaxPrice(50, 80)).toBe(50);
    });

    it('applies the query price when the pet has no budget', () => {
        expect(effectiveMaxPrice(0, 30)).toBe(30);
        expect(effectiveMaxPrice(0, undefined)).toBe(0);
    });
});

describe('zoom switch', () => {
    it('uses detail mode at and above DETAIL_ZOOM', () => {
        expect(mapMode(MAP_LIMITS.DETAIL_ZOOM)).toBe('detail');
        expect(mapMode(MAP_LIMITS.DETAIL_ZOOM + 3)).toBe('detail');
        expect(mapMode(MAP_LIMITS.DETAIL_ZOOM - 1)).toBe('top');
        expect(mapMode(12)).toBe('top');
    });

    it('returns everything up to DETAIL_LIMIT in detail mode', () => {
        const result = cutForZoom(ranked(34), 15);
        expect(result.mode).toBe('detail');
        expect(result.recommendations).toHaveLength(34);
        expect(cutForZoom(ranked(80), 16).recommendations).toHaveLength(
            MAP_LIMITS.DETAIL_LIMIT,
        );
    });

    it('returns only the top N in top mode, in rank order', () => {
        const all = ranked(34);
        const result = cutForZoom(all, 12);
        expect(result.mode).toBe('top');
        expect(result.recommendations).toEqual(all.slice(0, MAP_LIMITS.TOP_N));
    });

    it('lets limit lower but not raise the cut', () => {
        expect(cutForZoom(ranked(34), 15, 5).recommendations).toHaveLength(5);
        expect(cutForZoom(ranked(34), 12, 40).recommendations).toHaveLength(
            MAP_LIMITS.TOP_N,
        );
    });
});
