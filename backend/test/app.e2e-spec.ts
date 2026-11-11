import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { PG_CONNECTION } from './../src/database/database.module';
import { CATALOG } from './../src/catalog/catalog.data';
import type { CatalogItem } from './../src/catalog/catalog.types';

describe('Catalog HTTP integration', () => {
    let app: INestApplication<App>;
    const pool = { query: jest.fn() };
    const hashedSecret = bcrypt.hashSync('secret', 10);

    beforeAll(async () => {
        pool.query.mockReset().mockImplementation((sql: string) => {
            if (sql.includes('catalog_services')) {
                return Promise.resolve({ rows: CATALOG });
            }
            if (sql.includes('FROM users WHERE email')) {
                return Promise.resolve({
                    rows: [
                        {
                            id: 1,
                            firstname: 'Jane',
                            lastname: 'Doe',
                            email: 'jane@example.com',
                            password: hashedSecret,
                        },
                    ],
                });
            }
            if (sql.includes('FROM pets')) {
                return Promise.resolve({
                    rows: [
                        {
                            id: 10,
                            userId: 1,
                            name: 'Mochi',
                            species: 'dog',
                            needs: ['exercise'],
                            maxPrice: 2000,
                        },
                    ],
                });
            }
            return Promise.resolve({
                rows: [{ now: new Date('2026-01-01T00:00:00Z') }],
            });
        });
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

    it('enforces JWT authentication and ownership on protected routes', async () => {
        // 1. Unauthenticated request is rejected with 401
        await request(app.getHttpServer()).get('/pet-profile/me').expect(401);

        // 2. Login issues a signed JWT access_token
        const loginRes = await request(app.getHttpServer())
            .post('/auth/login')
            .send({ username: 'jane@example.com', password: 'secret' })
            .expect(201);
        const token = (loginRes.body as { access_token: string }).access_token;
        expect(typeof token).toBe('string');

        // 3. Authenticated request with Bearer token succeeds
        const petsRes = await request(app.getHttpServer())
            .get('/pet-profile/me')
            .set('Authorization', `Bearer ${token}`)
            .expect(200);
        expect(petsRes.body).toEqual([
            expect.objectContaining({ id: 10, userId: 1, name: 'Mochi' }),
        ]);

        // 4. Attempting to update another user's account returns 403 Forbidden
        await request(app.getHttpServer())
            .patch('/users/999')
            .set('Authorization', `Bearer ${token}`)
            .send({
                firstname: 'Jane',
                lastname: 'Doe',
                email: 'jane@example.com',
            })
            .expect(403);
    });

    afterAll(async () => {
        await app.close();
    });
});
