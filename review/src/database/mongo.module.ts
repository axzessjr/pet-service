import {
    Global,
    Inject,
    Logger,
    Module,
    OnApplicationShutdown,
    OnModuleInit,
} from '@nestjs/common';
import { Db, MongoClient, ObjectId } from 'mongodb';

export const MONGO_DB = 'MONGO_DB';

export type ReviewEventType =
    | 'review.created'
    | 'review.updated'
    | 'review.deleted';

export interface Aspects {
    quality?: number;
    value?: number;
    punctuality?: number;
    friendliness?: number;
}

export interface PhotoInfo {
    id: ObjectId;
    contentType: string;
    width: number;
    height: number;
    size: number;
}

// One document per review. Optional fields are simply absent, and photos,
// tags, and aspect ratings live inside the review instead of separate tables.
export interface ReviewDocument {
    _id: ObjectId;
    serviceId: number;
    service: { title: string; provider: string };
    ownerId: number;
    pet?: { id: number; name: string; species: string };
    rating: number;
    aspects?: Aspects;
    title?: string;
    comment: string;
    visitedOn?: string;
    tags: string[];
    wouldRecommend?: boolean;
    photos: PhotoInfo[];
    // Increases on every change; the publisher clears pendingEvent only if
    // the review has not changed since it was read.
    rev: number;
    pendingEvent?: ReviewEventType;
    deleted: boolean;
    createdAt: Date;
    updatedAt: Date;
    deletedAt?: Date;
}

// MONGODB_URL is usually a MongoDB Atlas connection string (mongodb+srv://...);
// a local server works too.
const client = new MongoClient(
    process.env.MONGODB_URL ?? 'mongodb://localhost:27017',
    { appName: 'pawpal-review' },
);

@Global()
@Module({
    providers: [
        {
            provide: MONGO_DB,
            useFactory: async (): Promise<Db> => {
                await client.connect();
                return client.db(process.env.MONGODB_DB ?? 'reviews');
            },
        },
    ],
    exports: [MONGO_DB],
})
export class MongoModule implements OnModuleInit, OnApplicationShutdown {
    private readonly logger = new Logger(MongoModule.name);

    constructor(@Inject(MONGO_DB) private readonly db: Db) {}

    async onModuleInit() {
        const reviews = this.db.collection<ReviewDocument>('reviews');
        // An owner can review the same service again after each visit, so
        // there is no unique index on serviceId + ownerId.
        await reviews.createIndex({ serviceId: 1, deleted: 1, createdAt: -1 });
        await reviews.createIndex({ ownerId: 1, deleted: 1, createdAt: -1 });
        // Small index: only reviews whose event has not been sent yet.
        await reviews.createIndex(
            { pendingEvent: 1 },
            { partialFilterExpression: { pendingEvent: { $exists: true } } },
        );
        this.logger.log('MongoDB reviews database is ready');
    }

    async onApplicationShutdown() {
        await client.close();
    }
}
