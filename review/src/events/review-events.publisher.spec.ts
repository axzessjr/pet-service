import { ObjectId } from 'mongodb';
import { buildEvent } from './review-events.publisher';

describe('buildEvent', () => {
    const review = {
        _id: new ObjectId('6650a1b2c3d4e5f601234567'),
        serviceId: 106,
        rating: 5,
        updatedAt: new Date('2026-10-15T08:00:00.000Z'),
    };

    it('carries the service totals the recommender stores', () => {
        expect(buildEvent(review, { ratingSum: 13, reviewCount: 3 }, 7)).toEqual({
            reviewId: '6650a1b2c3d4e5f601234567',
            serviceId: 106,
            rating: 5,
            averageRating: 4.33,
            reviewCount: 3,
            version: 7,
            occurredAt: '2026-10-15T08:00:00.000Z',
        });
    });

    it('reports an average of 0 when the last review was deleted', () => {
        expect(buildEvent(review, { ratingSum: 0, reviewCount: 0 }, 8)).toMatchObject({
            averageRating: 0,
            reviewCount: 0,
        });
    });
});
