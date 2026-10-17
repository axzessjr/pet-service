import {
    BadRequestException,
    ConflictException,
    Inject,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { Db, ObjectId } from 'mongodb';
import {
    MAX_PHOTOS,
    validateNewReview,
    validateReviewChanges,
} from '../common/validation';
import { MONGO_DB, ReviewDocument } from '../database/mongo.module';
import { PhotoStore } from './photo-store';

// What the API returns: string ids and no internal bookkeeping fields.
export interface ReviewView {
    id: string;
    serviceId: number;
    service: { title: string; provider: string };
    ownerId: number;
    pet: { id: number; name: string; species: string } | null;
    rating: number;
    aspects: ReviewDocument['aspects'] | null;
    title: string;
    comment: string;
    visitedOn: string | null;
    tags: string[];
    wouldRecommend: boolean | null;
    photos: { id: string; width: number; height: number }[];
    createdAt: Date;
    updatedAt: Date;
}

export interface ServiceRating {
    serviceId: number;
    averageRating: number;
    reviewCount: number;
    aspects: {
        quality: number | null;
        value: number | null;
        punctuality: number | null;
        friendliness: number | null;
    };
    recommendPercent: number | null;
    photoCount: number;
}

export function toView(doc: ReviewDocument): ReviewView {
    return {
        id: doc._id.toHexString(),
        serviceId: doc.serviceId,
        service: doc.service,
        ownerId: doc.ownerId,
        pet: doc.pet ?? null,
        rating: doc.rating,
        aspects: doc.aspects ?? null,
        title: doc.title ?? '',
        comment: doc.comment,
        visitedOn: doc.visitedOn ?? null,
        tags: doc.tags,
        wouldRecommend: doc.wouldRecommend ?? null,
        photos: doc.photos.map((photo) => ({
            id: photo.id.toHexString(),
            width: photo.width,
            height: photo.height,
        })),
        createdAt: doc.createdAt,
        updatedAt: doc.updatedAt,
    };
}

const round = (value: number | null, digits: number) =>
    value === null ? null : Math.round(value * 10 ** digits) / 10 ** digits;

@Injectable()
export class ReviewsService {
    constructor(
        @Inject(MONGO_DB) private readonly db: Db,
        private readonly photos: PhotoStore,
    ) {}

    private get reviews() {
        return this.db.collection<ReviewDocument>('reviews');
    }

    async create(body: unknown): Promise<ReviewView> {
        const input = validateNewReview(body);
        const photos = await this.photos.save(input.photos, input.ownerId);
        const now = new Date();
        const doc: ReviewDocument = {
            _id: new ObjectId(),
            serviceId: input.serviceId,
            service: input.service,
            ownerId: input.ownerId,
            ...(input.pet ? { pet: input.pet } : {}),
            rating: input.rating,
            ...(input.aspects ? { aspects: input.aspects } : {}),
            ...(input.title ? { title: input.title } : {}),
            comment: input.comment,
            ...(input.visitedOn ? { visitedOn: input.visitedOn } : {}),
            tags: input.tags,
            ...(input.wouldRecommend === undefined
                ? {}
                : { wouldRecommend: input.wouldRecommend }),
            photos,
            rev: 1,
            pendingEvent: 'review.created',
            deleted: false,
            createdAt: now,
            updatedAt: now,
        };
        try {
            await this.reviews.insertOne(doc);
        } catch (error) {
            // Do not leave photos behind for a review that was not saved.
            await this.photos.remove(photos.map((photo) => photo.id));
            throw error;
        }
        return toView(doc);
    }

    async list(filter: { serviceId: number } | { ownerId: number }) {
        const docs = await this.reviews
            .find({ ...filter, deleted: false })
            .sort({ createdAt: -1, _id: -1 })
            .toArray();
        return docs.map(toView);
    }

    async get(id: ObjectId): Promise<ReviewView> {
        const doc = await this.reviews.findOne({ _id: id, deleted: false });
        if (!doc) throw new NotFoundException('Review not found');
        return toView(doc);
    }

    async update(id: ObjectId, body: unknown): Promise<ReviewView> {
        const { ownerId, changes } = validateReviewChanges(body);
        const existing = await this.reviews.findOne({ _id: id, deleted: false });
        if (!existing || existing.ownerId !== ownerId) {
            throw new NotFoundException('Review not found');
        }

        const removing = new Set(changes.removePhotoIds.map((photoId) => photoId.toHexString()));
        const kept = existing.photos.filter((photo) => !removing.has(photo.id.toHexString()));
        if (kept.length + changes.addPhotos.length > MAX_PHOTOS) {
            throw new BadRequestException(`At most ${MAX_PHOTOS} photos per review`);
        }
        const added = await this.photos.save(changes.addPhotos, ownerId);

        const set: Partial<ReviewDocument> = {
            photos: [...kept, ...added],
            pendingEvent: 'review.updated',
            updatedAt: new Date(),
        };
        const unset: Record<string, ''> = {};
        if (changes.rating !== undefined) set.rating = changes.rating;
        if (changes.comment !== undefined) set.comment = changes.comment;
        if (changes.tags !== undefined) set.tags = changes.tags;
        if (changes.title !== undefined) {
            if (changes.title) set.title = changes.title;
            else unset.title = '';
        }
        if (changes.aspects !== undefined) {
            if (changes.aspects) set.aspects = changes.aspects;
            else unset.aspects = '';
        }
        if (changes.visitedOn !== undefined) {
            if (changes.visitedOn) set.visitedOn = changes.visitedOn;
            else unset.visitedOn = '';
        }
        if (changes.wouldRecommend !== undefined) {
            if (changes.wouldRecommend === null) unset.wouldRecommend = '';
            else set.wouldRecommend = changes.wouldRecommend;
        }

        // `rev` guards against two edits at once: the second one finds a
        // different rev and is rejected instead of silently overwriting.
        const updated = await this.reviews.findOneAndUpdate(
            { _id: id, ownerId, deleted: false, rev: existing.rev },
            {
                $set: set,
                $inc: { rev: 1 },
                ...(Object.keys(unset).length > 0 ? { $unset: unset } : {}),
            },
            { returnDocument: 'after' },
        );
        if (!updated) {
            await this.photos.remove(added.map((photo) => photo.id));
            throw new ConflictException(
                'The review changed at the same time. Reload and try again.',
            );
        }
        await this.photos.remove(
            existing.photos
                .filter((photo) => removing.has(photo.id.toHexString()))
                .map((photo) => photo.id),
        );
        return toView(updated);
    }

    // Soft delete: the document stays until its event is published, so the
    // recommender learns about the removal. Photos are removed right away.
    async delete(id: ObjectId, ownerId: number): Promise<void> {
        const now = new Date();
        const before = await this.reviews.findOneAndUpdate(
            { _id: id, ownerId, deleted: false },
            {
                $set: {
                    deleted: true,
                    deletedAt: now,
                    updatedAt: now,
                    pendingEvent: 'review.deleted',
                    photos: [],
                },
                $inc: { rev: 1 },
            },
            { returnDocument: 'before' },
        );
        if (!before) throw new NotFoundException('Review not found');
        await this.photos.remove(before.photos.map((photo) => photo.id));
    }

    // Per-service summary computed by MongoDB from the reviews themselves.
    async ratings(): Promise<ServiceRating[]> {
        const rows = await this.reviews
            .aggregate<{
                _id: number;
                averageRating: number;
                reviewCount: number;
                quality: number | null;
                value: number | null;
                punctuality: number | null;
                friendliness: number | null;
                recommendYes: number;
                recommendAnswered: number;
                photoCount: number;
            }>([
                { $match: { deleted: false } },
                {
                    $group: {
                        _id: '$serviceId',
                        averageRating: { $avg: '$rating' },
                        reviewCount: { $sum: 1 },
                        quality: { $avg: '$aspects.quality' },
                        value: { $avg: '$aspects.value' },
                        punctuality: { $avg: '$aspects.punctuality' },
                        friendliness: { $avg: '$aspects.friendliness' },
                        recommendYes: {
                            $sum: { $cond: [{ $eq: ['$wouldRecommend', true] }, 1, 0] },
                        },
                        recommendAnswered: {
                            $sum: {
                                $cond: [{ $eq: [{ $type: '$wouldRecommend' }, 'bool'] }, 1, 0],
                            },
                        },
                        photoCount: { $sum: { $size: '$photos' } },
                    },
                },
                { $sort: { _id: 1 } },
            ])
            .toArray();
        return rows.map((row) => ({
            serviceId: row._id,
            averageRating: round(row.averageRating, 2) ?? 0,
            reviewCount: row.reviewCount,
            aspects: {
                quality: round(row.quality, 1),
                value: round(row.value, 1),
                punctuality: round(row.punctuality, 1),
                friendliness: round(row.friendliness, 1),
            },
            recommendPercent:
                row.recommendAnswered > 0
                    ? Math.round((row.recommendYes / row.recommendAnswered) * 100)
                    : null,
            photoCount: row.photoCount,
        }));
    }
}
