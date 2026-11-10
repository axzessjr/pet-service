import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { PG_CONNECTION } from './../src/database/database.module';
import { CATALOG } from './../src/catalog/catalog.data';
import type { CatalogItem } from './../src/catalog/catalog.types';

describe('Catalog HTTP integration', () => {
    let app: INestApplication<App>;
    const pool = { query: jest.fn() };

    beforeAll(async () => {
        pool.query.mockReset().mockImplementation((sql: string) =>
            Promise.resolve({
                rows: sql.includes('catalog_services')
                    ? CATALOG
                    : [{ now: new Date('2026-01-01T00:00:00Z') }],
            }),
        );
        const moduleFixture: TestingModule = await Test.createTestingModule({
            imports: [AppModule],
        })
            .overrideProvider(PG_CONNECTION)
            .useValue(pool)
            .compile();

        app = moduleFixture.createNestApplication();
        await app.init();
    });

    it('/catalog (GET)', () => {
        return request(app.getHttpServer())
            .get('/catalog')
            .expect(200)
            .expect((response) => {
                expect(response.body).toEqual(CATALOG);
            });
    });

    it('filters database catalog rows through the HTTP route', () => {
        return request(app.getHttpServer())
            .get('/catalog')
            .query({ category: 'Grooming', q: 'cat' })
            .expect(200)
            .expect((response) => {
                const items = response.body as CatalogItem[];
                expect(items.length).toBeGreaterThan(0);
                expect(
                    items.every((item) => item.category === 'Grooming'),
                ).toBe(true);
            });
    });

    afterAll(async () => {
        await app.close();
    });
});
