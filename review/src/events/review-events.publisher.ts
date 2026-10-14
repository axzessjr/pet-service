import {
    Inject,
    Injectable,
    Logger,
    OnApplicationBootstrap,
    OnApplicationShutdown,
} from '@nestjs/common';
import * as amqp from 'amqplib';
import type { ChannelModel, ConfirmChannel } from 'amqplib';
import { Db, MongoServerError } from 'mongodb';
import { randomUUID } from 'node:crypto';
import { MONGO_DB, ReviewDocument } from '../database/mongo.module';

export const EVENTS_EXCHANGE = 'pawpal.events';

// Payload the recommender consumes. It carries the service's current totals,
// so the consumer stores them directly instead of replaying reviews.
export interface ReviewEvent {
    reviewId: string;
    serviceId: number;
    rating: number;
    averageRating: number;
    reviewCount: number;
    version: number;
    occurredAt: string;
}

export interface ServiceTotals {
    ratingSum: number;
    reviewCount: number;
}

export function buildEvent(
    review: Pick<ReviewDocument, '_id' | 'serviceId' | 'rating' | 'updatedAt'>,
    totals: ServiceTotals,
    version: number,
): ReviewEvent {
    return {
        reviewId: review._id.toHexString(),
        serviceId: review.serviceId,
        rating: review.rating,
        averageRating:
            totals.reviewCount > 0
                ? Math.round((totals.ratingSum / totals.reviewCount) * 100) / 100
                : 0,
        reviewCount: totals.reviewCount,
        version,
        occurredAt: review.updatedAt.toISOString(),
    };
}

const LEASE_MS = 15_000;

// Sends review events to RabbitMQ. Each review write marks the review with
// `pendingEvent` in the same document (a single atomic write). This publisher
// then recomputes the service totals from the reviews, publishes, waits for
// the broker's confirm, and clears the mark. Only one instance publishes at a
// time (a lease in the `locks` collection), so versions only go up.
// Delivery is at-least-once; the recommender ignores events that are not newer.
@Injectable()
export class ReviewEventsPublisher
    implements OnApplicationBootstrap, OnApplicationShutdown
{
    private readonly logger = new Logger(ReviewEventsPublisher.name);
    private readonly url = process.env.RABBITMQ_URL;
    private readonly instanceId = randomUUID();
    private connection?: ChannelModel;
    private channel?: ConfirmChannel;
    private timer?: NodeJS.Timeout;
    private busy = false;
    private failing = false;

    constructor(@Inject(MONGO_DB) private readonly db: Db) {}

    private get reviews() {
        return this.db.collection<ReviewDocument>('reviews');
    }

    onApplicationBootstrap() {
        if (!this.url) {
            this.logger.warn('RABBITMQ_URL is not set; events will stay pending');
            return;
        }
        this.timer = setInterval(() => void this.publishPending(), 1000);
    }

    async onApplicationShutdown() {
        clearInterval(this.timer);
        await this.disconnect();
    }

    async publishPending(): Promise<number> {
        if (this.busy) return 0;
        this.busy = true;
        try {
            if (!(await this.holdLease())) return 0;
            const pending = await this.reviews
                .find({ pendingEvent: { $exists: true } })
                .sort({ updatedAt: 1 })
                .limit(100)
                .toArray();
            if (pending.length === 0) return 0;

            const serviceIds = [...new Set(pending.map((review) => review.serviceId))];
            const totals = await this.totalsFor(serviceIds);
            const versions = new Map<number, number>();
            for (const serviceId of serviceIds) {
                versions.set(serviceId, await this.nextVersion(serviceId));
            }

            const channel = await this.getChannel();
            for (const review of pending) {
                const event = buildEvent(
                    review,
                    totals.get(review.serviceId) ?? { ratingSum: 0, reviewCount: 0 },
                    versions.get(review.serviceId)!,
                );
                channel.publish(
                    EVENTS_EXCHANGE,
                    review.pendingEvent!,
                    Buffer.from(JSON.stringify(event)),
                    {
                        persistent: true,
                        contentType: 'application/json',
                        messageId: `${event.reviewId}-${review.rev}`,
                        type: review.pendingEvent,
                    },
                );
            }
            await channel.waitForConfirms();

            // Clear the mark only if the review has not changed since it was
            // read; otherwise the next round publishes the newer state.
            await this.reviews.bulkWrite(
                pending.map((review) => ({
                    updateOne: {
                        filter: { _id: review._id, rev: review.rev },
                        update: { $unset: { pendingEvent: '' } },
                    },
                })),
            );
            if (this.failing) {
                this.logger.log('Review event publisher recovered');
                this.failing = false;
            }
            this.logger.log(`Published ${pending.length} event(s)`);
            return pending.length;
        } catch (error) {
            if (!this.failing) {
                this.logger.warn(`Could not publish events; will retry: ${String(error)}`);
                this.failing = true;
            }
            await this.disconnect();
            return 0;
        } finally {
            this.busy = false;
        }
    }

    // Totals from the reviews themselves (deleted reviews excluded).
    private async totalsFor(serviceIds: number[]): Promise<Map<number, ServiceTotals>> {
        const rows = await this.reviews
            .aggregate<{ _id: number; ratingSum: number; reviewCount: number }>([
                { $match: { serviceId: { $in: serviceIds }, deleted: false } },
                {
                    $group: {
                        _id: '$serviceId',
                        ratingSum: { $sum: '$rating' },
                        reviewCount: { $sum: 1 },
                    },
                },
            ])
            .toArray();
        return new Map(rows.map((row) => [row._id, row]));
    }

    // The next version is the previous one + 1, but never less than the
    // current time in milliseconds. Versions therefore keep increasing even
    // when this database is replaced (for example, moving to MongoDB Atlas)
    // while the recommender still holds versions from the old one.
    private async nextVersion(serviceId: number): Promise<number> {
        const row = await this.db
            .collection<{ _id: number; version: number }>('service_versions')
            .findOneAndUpdate(
                { _id: serviceId },
                [
                    {
                        $set: {
                            version: {
                                $max: [
                                    { $add: [{ $ifNull: ['$version', 0] }, 1] },
                                    Date.now(),
                                ],
                            },
                        },
                    },
                ],
                { upsert: true, returnDocument: 'after' },
            );
        return row!.version;
    }

    // Takes or renews the lease. Another instance holding a live lease makes
    // the upsert collide on `_id`, which means "not ours".
    private async holdLease(): Promise<boolean> {
        const now = new Date();
        try {
            const lease = await this.db
                .collection<{ _id: string; holder: string; expiresAt: Date }>('locks')
                .findOneAndUpdate(
                    {
                        _id: 'review-events',
                        $or: [{ holder: this.instanceId }, { expiresAt: { $lt: now } }],
                    },
                    {
                        $set: {
                            holder: this.instanceId,
                            expiresAt: new Date(now.getTime() + LEASE_MS),
                        },
                    },
                    { upsert: true, returnDocument: 'after' },
                );
            return lease?.holder === this.instanceId;
        } catch (error) {
            if (error instanceof MongoServerError && error.code === 11000) return false;
            throw error;
        }
    }

    private async getChannel(): Promise<ConfirmChannel> {
        if (this.channel) return this.channel;

        const connection = await amqp.connect(this.url!);
        // Errors are followed by 'close'; listening prevents an unhandled 'error' crash.
        connection.on('error', () => undefined);
        connection.on('close', () => {
            this.connection = undefined;
            this.channel = undefined;
        });
        const channel = await connection.createConfirmChannel();
        channel.on('error', () => undefined);
        channel.on('close', () => {
            this.channel = undefined;
        });
        await channel.assertExchange(EVENTS_EXCHANGE, 'topic', { durable: true });

        this.connection = connection;
        this.channel = channel;
        return channel;
    }

    private async disconnect(): Promise<void> {
        const connection = this.connection;
        this.connection = undefined;
        this.channel = undefined;
        await connection?.close().catch(() => undefined);
    }
}
