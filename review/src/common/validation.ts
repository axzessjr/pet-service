import { BadRequestException } from '@nestjs/common';
import { ObjectId } from 'mongodb';
import type { Aspects } from '../database/mongo.module';

const MAX_INT = 2147483647;
export const MAX_PHOTOS = 4;
const ASPECT_KEYS = ['quality', 'value', 'punctuality', 'friendliness'] as const;

export function positiveInteger(value: unknown, name: string): number {
    if (
        typeof value !== 'number' ||
        !Number.isSafeInteger(value) ||
        value <= 0 ||
        value > MAX_INT
    ) {
        throw new BadRequestException(`${name} must be a positive integer`);
    }
    return value;
}

// Query strings arrive as text, e.g. ?ownerId=1
export function positiveIntegerParam(value: unknown, name: string): number {
    if (typeof value !== 'string' || !/^[1-9]\d{0,9}$/.test(value)) {
        throw new BadRequestException(`${name} must be a positive integer`);
    }
    return positiveInteger(Number(value), name);
}

export function objectId(value: unknown, name: string): ObjectId {
    if (typeof value !== 'string' || !/^[0-9a-f]{24}$/i.test(value)) {
        throw new BadRequestException(`${name} must be a 24-character hex id`);
    }
    return new ObjectId(value);
}

export function stars(value: unknown, name: string): number {
    if (
        typeof value !== 'number' ||
        !Number.isInteger(value) ||
        value < 1 ||
        value > 5
    ) {
        throw new BadRequestException(`${name} must be an integer from 1 to 5`);
    }
    return value;
}

function text(
    value: unknown,
    name: string,
    maxLength: number,
    required: boolean,
): string {
    if (value === undefined || value === null) {
        if (required) throw new BadRequestException(`${name} is required`);
        return '';
    }
    if (typeof value !== 'string') {
        throw new BadRequestException(`${name} must be text`);
    }
    const trimmed = value.trim();
    if (required && !trimmed) {
        throw new BadRequestException(`${name} is required`);
    }
    if (trimmed.length > maxLength) {
        throw new BadRequestException(
            `${name} must be at most ${maxLength} characters`,
        );
    }
    return trimmed;
}

// Optional ratings for parts of the visit. Unknown keys are rejected; an
// empty object means "no aspect ratings".
export function aspects(value: unknown): Aspects | undefined {
    if (value === undefined || value === null) return undefined;
    if (typeof value !== 'object' || Array.isArray(value)) {
        throw new BadRequestException('aspects must be an object');
    }
    const input = value as Record<string, unknown>;
    const unknown = Object.keys(input).filter(
        (key) => !(ASPECT_KEYS as readonly string[]).includes(key),
    );
    if (unknown.length > 0) {
        throw new BadRequestException(`Unknown aspect: ${unknown.join(', ')}`);
    }
    const result: Aspects = {};
    for (const key of ASPECT_KEYS) {
        if (input[key] !== undefined && input[key] !== null) {
            result[key] = stars(input[key], `aspects.${key}`);
        }
    }
    return Object.keys(result).length > 0 ? result : undefined;
}

// A calendar date (YYYY-MM-DD) that is not in the future and not more than
// two years ago.
export function visitedOn(value: unknown): string | undefined {
    if (value === undefined || value === null || value === '') return undefined;
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        throw new BadRequestException('visitedOn must be a date (YYYY-MM-DD)');
    }
    const date = new Date(`${value}T00:00:00Z`);
    if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
        throw new BadRequestException('visitedOn must be a real date');
    }
    const now = Date.now();
    // One day of slack for time zones ahead of UTC.
    if (date.getTime() > now + 24 * 3600 * 1000) {
        throw new BadRequestException('visitedOn cannot be in the future');
    }
    if (date.getTime() < now - 2 * 365 * 24 * 3600 * 1000) {
        throw new BadRequestException(
            'visitedOn must be within the last two years',
        );
    }
    return value;
}

// Lowercase, trimmed, without duplicates.
export function tags(value: unknown): string[] {
    if (value === undefined || value === null) return [];
    if (!Array.isArray(value) || !value.every((tag) => typeof tag === 'string')) {
        throw new BadRequestException('tags must be a list of text values');
    }
    const cleaned = [
        ...new Set(
            (value as string[])
                .map((tag) => tag.trim().toLowerCase())
                .filter(Boolean),
        ),
    ];
    if (cleaned.length > 8) {
        throw new BadRequestException('tags can have at most 8 values');
    }
    if (cleaned.some((tag) => tag.length > 30)) {
        throw new BadRequestException('each tag must be at most 30 characters');
    }
    return cleaned;
}

export function optionalBoolean(value: unknown, name: string): boolean | undefined {
    if (value === undefined || value === null) return undefined;
    if (typeof value !== 'boolean') {
        throw new BadRequestException(`${name} must be true or false`);
    }
    return value;
}

// Photos arrive as base64 strings (optionally data URLs) and are checked and
// re-encoded by PhotoStore.
export function photoUploads(value: unknown, name: string): string[] {
    if (value === undefined || value === null) return [];
    if (!Array.isArray(value) || !value.every((item) => typeof item === 'string')) {
        throw new BadRequestException(`${name} must be a list of base64 images`);
    }
    if (value.length > MAX_PHOTOS) {
        throw new BadRequestException(`At most ${MAX_PHOTOS} photos per review`);
    }
    return value as string[];
}

export interface NewReviewInput {
    serviceId: number;
    service: { title: string; provider: string };
    ownerId: number;
    pet?: { id: number; name: string; species: string };
    rating: number;
    aspects?: Aspects;
    title: string;
    comment: string;
    visitedOn?: string;
    tags: string[];
    wouldRecommend?: boolean;
    photos: string[];
}

function asObject(body: unknown): Record<string, unknown> {
    if (typeof body !== 'object' || body === null || Array.isArray(body)) {
        throw new BadRequestException('Send a JSON object');
    }
    return body as Record<string, unknown>;
}

// `service` and `pet` are snapshots added by the API gateway, which owns the
// catalog and pet data.
export function validateNewReview(body: unknown): NewReviewInput {
    const input = asObject(body);
    const service = asObject(input.service ?? null);
    let pet: NewReviewInput['pet'];
    if (input.pet !== undefined && input.pet !== null) {
        const raw = asObject(input.pet);
        pet = {
            id: positiveInteger(raw.id, 'pet.id'),
            name: text(raw.name, 'pet.name', 100, true),
            species: text(raw.species, 'pet.species', 50, true),
        };
    }
    return {
        serviceId: positiveInteger(input.serviceId, 'serviceId'),
        service: {
            title: text(service.title, 'service.title', 100, true),
            provider: text(service.provider, 'service.provider', 100, true),
        },
        ownerId: positiveInteger(input.ownerId, 'ownerId'),
        pet,
        rating: stars(input.rating, 'rating'),
        aspects: aspects(input.aspects),
        title: text(input.title, 'title', 100, false),
        comment: text(input.comment, 'comment', 2000, false),
        visitedOn: visitedOn(input.visitedOn),
        tags: tags(input.tags),
        wouldRecommend: optionalBoolean(input.wouldRecommend, 'wouldRecommend'),
        photos: photoUploads(input.photos, 'photos'),
    };
}

export interface ReviewChanges {
    rating?: number;
    aspects?: Aspects | null;
    title?: string;
    comment?: string;
    visitedOn?: string | null;
    tags?: string[];
    wouldRecommend?: boolean | null;
    addPhotos: string[];
    removePhotoIds: ObjectId[];
}

const CHANGE_FIELDS = [
    'ownerId',
    'rating',
    'aspects',
    'title',
    'comment',
    'visitedOn',
    'tags',
    'wouldRecommend',
    'addPhotos',
    'removePhotoIds',
];

// For PATCH: only the fields that were sent. `null` clears an optional field.
export function validateReviewChanges(body: unknown): {
    ownerId: number;
    changes: ReviewChanges;
} {
    const input = asObject(body);
    const unknown = Object.keys(input).filter((key) => !CHANGE_FIELDS.includes(key));
    if (unknown.length > 0) {
        throw new BadRequestException(`Unknown field: ${unknown.join(', ')}`);
    }
    const changes: ReviewChanges = {
        addPhotos: photoUploads(input.addPhotos, 'addPhotos'),
        removePhotoIds: Array.isArray(input.removePhotoIds)
            ? input.removePhotoIds.map((id) => objectId(id, 'removePhotoIds'))
            : input.removePhotoIds === undefined
              ? []
              : (() => {
                    throw new BadRequestException(
                        'removePhotoIds must be a list of ids',
                    );
                })(),
    };
    if (input.rating !== undefined) changes.rating = stars(input.rating, 'rating');
    if (input.aspects !== undefined) changes.aspects = aspects(input.aspects) ?? null;
    if (input.title !== undefined) changes.title = text(input.title, 'title', 100, false);
    if (input.comment !== undefined) {
        changes.comment = text(input.comment, 'comment', 2000, false);
    }
    if (input.visitedOn !== undefined) {
        changes.visitedOn = visitedOn(input.visitedOn) ?? null;
    }
    if (input.tags !== undefined) changes.tags = tags(input.tags);
    if (input.wouldRecommend !== undefined) {
        changes.wouldRecommend =
            optionalBoolean(input.wouldRecommend, 'wouldRecommend') ?? null;
    }
    const sent = Object.keys(input).filter((key) => key !== 'ownerId');
    if (sent.length === 0) {
        throw new BadRequestException('Send at least one field to change');
    }
    return { ownerId: positiveInteger(input.ownerId, 'ownerId'), changes };
}
