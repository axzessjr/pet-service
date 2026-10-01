import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import { RecommendationService } from './recommendation.service';
import { SavedRecommendationController } from './saved-recommendation.controller';

describe('SavedRecommendationController', () => {
    const id = '292b8266-d727-4eba-9bce-598b16117078';
    const saved = {
        id,
        petId: 1,
        limit: 5,
        matches: [],
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
    };
    const service = {
        createSaved: jest.fn(),
        getSaved: jest.fn(),
        listSaved: jest.fn(),
        updateSaved: jest.fn(),
        deleteSaved: jest.fn(),
    };
    let app: INestApplication<App>;

    beforeEach(async () => {
        for (const method of Object.values(service)) method.mockReset();
        service.createSaved.mockResolvedValue(saved);
        service.getSaved.mockResolvedValue(saved);
        service.listSaved.mockResolvedValue([saved]);
        service.updateSaved.mockResolvedValue({ ...saved, limit: 2 });
        service.deleteSaved.mockResolvedValue(undefined);
        const module = await Test.createTestingModule({
            controllers: [SavedRecommendationController],
            providers: [{ provide: RecommendationService, useValue: service }],
        }).compile();
        app = module.createNestApplication();
        await app.init();
    });

    afterEach(async () => {
        await app.close();
    });

    it('routes create, read, list, update, and delete', async () => {
        await request(app.getHttpServer())
            .post('/recommendations')
            .send({ petId: 1 })
            .expect(201);
        expect(service.createSaved).toHaveBeenCalledWith(1, 5);

        await request(app.getHttpServer())
            .get('/recommendations?petId=1')
            .expect(200);
        expect(service.listSaved).toHaveBeenCalledWith(1);

        await request(app.getHttpServer())
            .get(`/recommendations/${id}`)
            .expect(200);

        await request(app.getHttpServer())
            .put(`/recommendations/${id}`)
            .send({ limit: 2 })
            .expect(200);
        expect(service.updateSaved).toHaveBeenCalledWith(id, 2);

        await request(app.getHttpServer())
            .delete(`/recommendations/${id}`)
            .expect(204);
        expect(service.deleteSaved).toHaveBeenCalledWith(id);
    });

    it('rejects invalid create input', async () => {
        await request(app.getHttpServer())
            .post('/recommendations')
            .send({ petId: -1, limit: 0 })
            .expect(400);
        await request(app.getHttpServer())
            .get('/recommendations?petId=abc')
            .expect(400);
        await request(app.getHttpServer())
            .put(`/recommendations/${id}`)
            .send({ limit: 101 })
            .expect(400);
        expect(service.createSaved).not.toHaveBeenCalled();
    });
});
