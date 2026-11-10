import {
    BadRequestException,
    HttpException,
    Injectable,
    Logger,
    NotFoundException,
    ServiceUnavailableException,
} from '@nestjs/common';
import { Readable } from 'node:stream';
import type { ReadableStream as WebReadableStream } from 'node:stream/web';
import { CatalogService } from '../catalog/catalog.service';
import { UPSTREAMS } from '../gateway/upstreams';
import { PetProfileService } from '../pet-profile/pet-profile.service';

function positiveInteger(value: unknown, name: string): number {
    if (
        typeof value !== 'number' ||
        !Number.isSafeInteger(value) ||
        value <= 0 ||
        value > 2147483647
    ) {
        throw new BadRequestException(`${name} must be a positive integer`);
    }
    return value;
}

export interface ForwardOptions {
    query?: Record<string, string | undefined>;
    body?: unknown;
    // How long to wait for the review service; defaults to 3 seconds.
    timeoutMs?: number;
}

// Writes with photos are resized by the review service, so they wait longer.
export const PHOTO_TIMEOUT_MS = 15_000;

// Gateway side of the review service. Most calls are forwarded as they are;
// creating a review also checks the service and pet, which live in this app.
@Injectable()
export class ReviewService {
    private readonly logger = new Logger(ReviewService.name);
    private readonly baseUrl = UPSTREAMS.review.url;

    constructor(
        private readonly catalogService: CatalogService,
        private readonly petProfileService: PetProfileService,
    ) {}

    async createReview(body: Record<string, unknown> | undefined) {
        const ownerId = positiveInteger(body?.ownerId, 'ownerId');
        const serviceId = positiveInteger(body?.serviceId, 'serviceId');
        const catalog = await this.catalogService.getCatalogItems();
        const service = catalog.find((item) => item.id === serviceId);
        if (!service) {
            throw new NotFoundException(`Service ${serviceId} was not found`);
        }

        let pet: { id: number; name: string; species: string } | undefined;
        if (body?.petId !== undefined && body?.petId !== null) {
            const petId = positiveInteger(body.petId, 'petId');
            const found = await this.petProfileService.getPetById(petId);
            if (!found || found.userId !== ownerId) {
                throw new NotFoundException(`Pet ${petId} was not found`);
            }
            if (!service.species.includes(found.species)) {
                throw new BadRequestException(
                    `${service.title} is not offered for ${found.species}s`,
                );
            }
            pet = { id: found.id, name: found.name, species: found.species };
        }

        // The service and pet snapshots always come from this app, never
        // from the client, so a review cannot claim the wrong service or pet.
        const fields = { ...body };
        delete fields.petId;
        delete fields.pet;
        delete fields.service;
        return this.forward('POST', '/reviews', {
            body: {
                ...fields,
                serviceId,
                ownerId,
                service: { title: service.title, provider: service.provider },
                ...(pet ? { pet } : {}),
            },
            timeoutMs: PHOTO_TIMEOUT_MS,
        });
    }

    async forward<T = unknown>(
        method: string,
        path: string,
        { query, body, timeoutMs = 3000 }: ForwardOptions = {},
    ): Promise<T> {
        const response = await this.send(method, path, {
            query,
            body,
            timeoutMs,
        });
        const data: unknown =
            response.status === 204
                ? undefined
                : await response.json().catch(() => undefined);
        if (response.ok) return data as T;
        if (response.status >= 500) {
            this.logger.warn(`Review service returned ${response.status}`);
            throw new ServiceUnavailableException(
                'Reviews are temporarily unavailable',
            );
        }
        // Pass 4xx errors such as 404 or 409 through unchanged.
        throw new HttpException(data ?? response.statusText, response.status);
    }

    // Streams a stored photo instead of buffering it.
    async openPhoto(
        id: string,
    ): Promise<{ stream: Readable; length?: number }> {
        const response = await this.send('GET', `/photos/${id}`, {
            timeoutMs: 10_000,
        });
        if (response.status === 404)
            throw new NotFoundException('Photo not found');
        if (!response.ok || !response.body) {
            throw new ServiceUnavailableException(
                'Photos are temporarily unavailable',
            );
        }
        const length = Number(response.headers.get('content-length'));
        return {
            stream: Readable.fromWeb(response.body as WebReadableStream),
            length: Number.isFinite(length) && length > 0 ? length : undefined,
        };
    }

    private async send(
        method: string,
        path: string,
        { query, body, timeoutMs = 3000 }: ForwardOptions,
    ): Promise<Response> {
        const url = new URL(path, this.baseUrl);
        for (const [key, value] of Object.entries(query ?? {})) {
            if (value !== undefined) url.searchParams.set(key, value);
        }
        try {
            return await fetch(url, {
                method,
                headers:
                    body === undefined
                        ? undefined
                        : { 'Content-Type': 'application/json' },
                body: body === undefined ? undefined : JSON.stringify(body),
                signal: AbortSignal.timeout(timeoutMs),
            });
        } catch (error: unknown) {
            this.logger.warn(`Review service unavailable: ${String(error)}`);
            throw new ServiceUnavailableException(
                'Reviews are temporarily unavailable',
            );
        }
    }
}
