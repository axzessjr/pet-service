import { Test, TestingModule } from '@nestjs/testing';
import {
    CatalogService,
    matchesCategory,
    matchesText,
} from './catalog.service';

const CHULA = { lat: 13.7384, lng: 100.532 };

// Haversine distance in km.
function distanceKm(
    a: { lat: number; lng: number },
    b: { lat: number; lng: number },
): number {
    const rad = (deg: number) => (deg * Math.PI) / 180;
    const dLat = rad(b.lat - a.lat);
    const dLng = rad(b.lng - a.lng);
    const h =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
    return 2 * 6371 * Math.asin(Math.sqrt(h));
}

describe('CatalogService', () => {
    let service: CatalogService;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [CatalogService],
        }).compile();

        service = module.get<CatalogService>(CatalogService);
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    describe('catalog data', () => {
        const items = () => service.getCatalogItems();

        it('has about 60 services with unique ids', () => {
            const ids = items().map((item) => item.id);
            expect(ids.length).toBeGreaterThanOrEqual(55);
            expect(new Set(ids).size).toBe(ids.length);
        });

        it('gives every service a distinct location near Chulalongkorn', () => {
            const seen = new Set<string>();
            for (const { id, location } of items()) {
                expect([id, location.address.length > 0]).toEqual([id, true]);
                expect([id, location.district.length > 0]).toEqual([id, true]);
                expect([id, distanceKm(CHULA, location) < 3.6]).toEqual([
                    id,
                    true,
                ]);
                const key = `${location.lat},${location.lng}`;
                expect([id, seen.has(key)]).toEqual([id, false]);
                seen.add(key);
            }
        });

        it('has at least 6 services in every category', () => {
            const counts = new Map<string, number>();
            for (const { category } of items()) {
                counts.set(category, (counts.get(category) ?? 0) + 1);
            }
            for (const category of [
                'Walking',
                'Grooming',
                'Sitting',
                'Training',
                'Enrichment',
                'Wellness',
            ]) {
                expect([category, (counts.get(category) ?? 0) >= 6]).toEqual([
                    category,
                    true,
                ]);
            }
        });

        it('is denser around the campus than further out', () => {
            const near = items().filter(
                (item) => distanceKm(CHULA, item.location) <= 1,
            ).length;
            const far = items().filter(
                (item) => distanceKm(CHULA, item.location) > 1.5,
            ).length;
            expect(near).toBeGreaterThan(far);
        });
    });

    describe('search', () => {
        it('matches text case-insensitively across fields', () => {
            const [item] = service.getCatalogItems();
            expect(matchesText(item, 'NEIGHBORHOOD')).toBe(true);
            expect(matchesText(item, 'john doe')).toBe(true);
            expect(matchesText(item, 'water breaks')).toBe(true);
            expect(matchesText(item, 'suan luang')).toBe(true);
            expect(matchesText(item, 'chula soi 9')).toBe(true);
            expect(matchesText(item, 'social')).toBe(true);
            expect(matchesText(item, 'grooming')).toBe(false);
            expect(matchesText(item, '   ')).toBe(true);
        });

        it('matches hyphenated tags with or without the hyphen', () => {
            const item = service
                .getCatalogItems()
                .find((entry) => entry.tags.includes('coat-care'));
            expect(item && matchesText(item, 'coat-care')).toBe(true);
            expect(item && matchesText(item, 'coat care')).toBe(true);
        });

        it('matches category exactly, ignoring case', () => {
            const [item] = service.getCatalogItems();
            expect(matchesCategory(item, 'walking')).toBe(true);
            expect(matchesCategory(item, 'Walk')).toBe(false);
            expect(matchesCategory(item, '')).toBe(true);
        });

        it('filters by q and category together', () => {
            const results = service.search({
                q: 'groom',
                category: 'Grooming',
            });
            expect(results.length).toBeGreaterThan(0);
            expect(results.every((item) => item.category === 'Grooming')).toBe(
                true,
            );
            expect(service.search({ q: 'groom', category: 'Walking' })).toEqual(
                [],
            );
        });
    });
});
