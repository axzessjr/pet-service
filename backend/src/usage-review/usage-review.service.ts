import {
    BadRequestException,
    HttpException,
    Injectable,
    Logger,
    NotFoundException,
    ServiceUnavailableException,
} from '@nestjs/common';
import { CatalogService } from '../catalog/catalog.service';
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
}

// Gateway side of the usage and review service. Most calls are forwarded as
// they are; booking also checks the pet and catalog, which live in this app.
@Injectable()
export class UsageReviewService {
    private readonly logger = new Logger(UsageReviewService.name);
    private readonly baseUrl =
        process.env.USAGE_REVIEW_URL ?? 'http://localhost:3001';

    constructor(
        private readonly catalogService: CatalogService,
        private readonly petProfileService: PetProfileService,
    ) {}

    async createUsage(body: Record<string, unknown> | undefined) {
        const ownerId = positiveInteger(body?.ownerId, 'ownerId');
        const petId = positiveInteger(body?.petId, 'petId');
        const serviceId = positiveInteger(body?.serviceId, 'serviceId');

        const pet = await this.petProfileService.getPetById(petId);
        if (!pet || pet.userId !== ownerId) {
            throw new NotFoundException(`Pet ${petId} was not found`);
        }
        const service = this.catalogService
            .getCatalogItems()
            .find((item) => item.id === serviceId);
        if (!service) {
            throw new NotFoundException(`Service ${serviceId} was not found`);
        }
        if (!service.species.includes(pet.species)) {
            throw new BadRequestException(
                `${service.title} is not offered for ${pet.species}s`,
            );
        }

        // Snapshot title, provider, and price so later catalog changes do not
        // rewrite what was booked.
        return this.forward('POST', '/usages', {
            body: {
                ownerId,
                petId,
                serviceId,
                serviceTitle: service.title,
                provider: service.provider,
                price: service.price,
            },
        });
    }

    async forward<T = unknown>(
        method: string,
        path: string,
        { query, body }: ForwardOptions = {},
    ): Promise<T> {
        const url = new URL(path, this.baseUrl);
        for (const [key, value] of Object.entries(query ?? {})) {
            if (value !== undefined) url.searchParams.set(key, value);
        }

        let response: Response;
        try {
            response = await fetch(url, {
                method,
                headers:
                    body === undefined
                        ? undefined
                        : { 'Content-Type': 'application/json' },
                body: body === undefined ? undefined : JSON.stringify(body),
                signal: AbortSignal.timeout(3000),
            });
        } catch (error: unknown) {
            this.logger.warn(
                `Usage and review service unavailable: ${String(error)}`,
            );
            throw new ServiceUnavailableException(
                'Usages and reviews are temporarily unavailable',
            );
        }

        const data: unknown =
            response.status === 204
                ? undefined
                : await response.json().catch(() => undefined);
        if (response.ok) return data as T;
        if (response.status >= 500) {
            this.logger.warn(
                `Usage and review service returned ${response.status}`,
            );
            throw new ServiceUnavailableException(
                'Usages and reviews are temporarily unavailable',
            );
        }
        // Pass 4xx errors such as 404 or 409 through unchanged.
        throw new HttpException(data ?? response.statusText, response.status);
    }
}
