import {
    BadRequestException,
    ConflictException,
    Inject,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { Pool, PoolClient } from 'pg';
import { inTransaction, PG_POOL } from '../database/database.module';
import { comment, positiveInteger, rating } from '../common/validation';

export interface Review {
    id: number;
    usageId: number;
    serviceId: number;
    ownerId: number;
    rating: number;
    comment: string;
    createdAt: Date;
    updatedAt: Date;
}

export interface ServiceRating {
    serviceId: number;
    averageRating: number;
    reviewCount: number;
}

export type ReviewEventType =
    'review.created' | 'review.updated' | 'review.deleted';

// Published to RabbitMQ. It carries the service's new totals so consumers can
// store them directly instead of replaying every review.
export interface ReviewEvent {
    reviewId: number;
    usageId: number;
    serviceId: number;
    rating: number;
    averageRating: number;
    reviewCount: number;
    version: number;
    occurredAt: string;
}

const REVIEW_COLUMNS = `
    id,
    usage_id AS "usageId",
    service_id AS "serviceId",
    owner_id AS "ownerId",
    rating,
    comment,
    created_at AS "createdAt",
    updated_at AS "updatedAt"
`;

function average(sum: number, count: number): number {
    return count > 0 ? Math.round((sum / count) * 100) / 100 : 0;
}

@Injectable()
export class ReviewsService {
    constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

    async create(input: Record<string, unknown>): Promise<Review> {
        const usageId = positiveInteger(input?.usageId, 'usageId');
        const ownerId = positiveInteger(input?.ownerId, 'ownerId');
        const stars = rating(input?.rating);
        const text = comment(input?.comment);

        return inTransaction(this.pool, async (client) => {
            // Lock the usage so its status cannot change while we review it.
            const { rows: usages } = await client.query<{
                ownerId: number;
                serviceId: number;
                status: string;
            }>(
                `SELECT owner_id AS "ownerId", service_id AS "serviceId", status
                 FROM usages WHERE id = $1 FOR UPDATE`,
                [usageId],
            );
            const usage = usages[0];
            if (!usage || usage.ownerId !== ownerId) {
                throw new NotFoundException(`Usage ${usageId} not found`);
            }
            if (usage.status !== 'completed') {
                throw new ConflictException(
                    'Only completed usages can be reviewed',
                );
            }

            const { rows } = await client.query<Review>(
                `INSERT INTO reviews (usage_id, service_id, owner_id, rating, comment)
                 VALUES ($1, $2, $3, $4, $5)
                 ON CONFLICT (usage_id) DO NOTHING
                 RETURNING ${REVIEW_COLUMNS}`,
                [usageId, usage.serviceId, ownerId, stars, text],
            );
            if (!rows[0]) {
                throw new ConflictException(
                    `Usage ${usageId} already has a review`,
                );
            }
            await this.recordRatingChange(
                client,
                'review.created',
                rows[0],
                stars,
                1,
            );
            return rows[0];
        });
    }

    async list(query: {
        serviceId?: number;
        ownerId?: number;
    }): Promise<Review[]> {
        const [column, value] =
            query.serviceId !== undefined
                ? ['service_id', query.serviceId]
                : ['owner_id', query.ownerId];
        const { rows } = await this.pool.query<Review>(
            `SELECT ${REVIEW_COLUMNS} FROM reviews
             WHERE ${column} = $1
             ORDER BY created_at DESC, id DESC`,
            [value],
        );
        return rows;
    }

    async get(id: number): Promise<Review> {
        const { rows } = await this.pool.query<Review>(
            `SELECT ${REVIEW_COLUMNS} FROM reviews WHERE id = $1`,
            [id],
        );
        if (!rows[0]) throw new NotFoundException(`Review ${id} not found`);
        return rows[0];
    }

    async update(id: number, input: Record<string, unknown>): Promise<Review> {
        const ownerId = positiveInteger(input?.ownerId, 'ownerId');
        if (input?.rating === undefined && input?.comment === undefined) {
            throw new BadRequestException('Provide rating or comment');
        }
        const newRating =
            input.rating === undefined ? undefined : rating(input.rating);
        const newComment =
            input.comment === undefined ? undefined : comment(input.comment);

        return inTransaction(this.pool, async (client) => {
            const existing = await this.lockOwned(client, id, ownerId);
            const { rows } = await client.query<Review>(
                `UPDATE reviews SET rating = $2, comment = $3, updated_at = now()
                 WHERE id = $1
                 RETURNING ${REVIEW_COLUMNS}`,
                [
                    id,
                    newRating ?? existing.rating,
                    newComment ?? existing.comment,
                ],
            );
            await this.recordRatingChange(
                client,
                'review.updated',
                rows[0],
                rows[0].rating - existing.rating,
                0,
            );
            return rows[0];
        });
    }

    async delete(id: number, ownerId: number): Promise<void> {
        await inTransaction(this.pool, async (client) => {
            const existing = await this.lockOwned(client, id, ownerId);
            await client.query('DELETE FROM reviews WHERE id = $1', [id]);
            await this.recordRatingChange(
                client,
                'review.deleted',
                existing,
                -existing.rating,
                -1,
            );
        });
    }

    async ratings(): Promise<ServiceRating[]> {
        const { rows } = await this.pool.query<{
            serviceId: number;
            ratingSum: number;
            reviewCount: number;
        }>(
            `SELECT service_id AS "serviceId", rating_sum AS "ratingSum",
                    review_count AS "reviewCount"
             FROM service_ratings
             WHERE review_count > 0
             ORDER BY service_id`,
        );
        return rows.map(({ serviceId, ratingSum, reviewCount }) => ({
            serviceId,
            averageRating: average(ratingSum, reviewCount),
            reviewCount,
        }));
    }

    private async lockOwned(
        client: PoolClient,
        id: number,
        ownerId: number,
    ): Promise<Review> {
        const { rows } = await client.query<Review>(
            `SELECT ${REVIEW_COLUMNS} FROM reviews WHERE id = $1 FOR UPDATE`,
            [id],
        );
        if (!rows[0] || rows[0].ownerId !== ownerId) {
            throw new NotFoundException(`Review ${id} not found`);
        }
        return rows[0];
    }

    // Updates the service totals and queues the event in the caller's
    // transaction, so the review, totals, and event commit or roll back together.
    private async recordRatingChange(
        client: PoolClient,
        type: ReviewEventType,
        review: Review,
        sumDelta: number,
        countDelta: number,
    ): Promise<void> {
        const { rows } = await client.query<{
            ratingSum: number;
            reviewCount: number;
            version: number;
        }>(
            `INSERT INTO service_ratings (service_id, rating_sum, review_count, version)
             VALUES ($1, $2, $3, 1)
             ON CONFLICT (service_id) DO UPDATE SET
                 rating_sum = service_ratings.rating_sum + EXCLUDED.rating_sum,
                 review_count = service_ratings.review_count + EXCLUDED.review_count,
                 version = service_ratings.version + 1
             RETURNING rating_sum AS "ratingSum", review_count AS "reviewCount", version`,
            [review.serviceId, sumDelta, countDelta],
        );
        const totals = rows[0];
        const event: ReviewEvent = {
            reviewId: review.id,
            usageId: review.usageId,
            serviceId: review.serviceId,
            rating: review.rating,
            averageRating: average(totals.ratingSum, totals.reviewCount),
            reviewCount: totals.reviewCount,
            version: totals.version,
            occurredAt: new Date().toISOString(),
        };
        await client.query(
            'INSERT INTO outbox (event_type, payload) VALUES ($1, $2)',
            [type, event],
        );
    }
}
