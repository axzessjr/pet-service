import {
    BadRequestException,
    ConflictException,
    Inject,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { Pool } from 'pg';
import { PG_POOL } from '../database/database.module';
import { nonEmptyText, positiveInteger } from '../common/validation';

export type UsageStatus = 'booked' | 'completed' | 'cancelled';

export interface Usage {
    id: number;
    ownerId: number;
    petId: number;
    serviceId: number;
    serviceTitle: string;
    provider: string;
    price: number;
    status: UsageStatus;
    completedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
}

export const USAGE_COLUMNS = `
    id,
    owner_id AS "ownerId",
    pet_id AS "petId",
    service_id AS "serviceId",
    service_title AS "serviceTitle",
    provider,
    price::float AS price,
    status,
    completed_at AS "completedAt",
    created_at AS "createdAt",
    updated_at AS "updatedAt"
`;

@Injectable()
export class UsagesService {
    constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

    async create(input: Record<string, unknown>): Promise<Usage> {
        const ownerId = positiveInteger(input?.ownerId, 'ownerId');
        const petId = positiveInteger(input?.petId, 'petId');
        const serviceId = positiveInteger(input?.serviceId, 'serviceId');
        const serviceTitle = nonEmptyText(input?.serviceTitle, 'serviceTitle');
        const provider = nonEmptyText(input?.provider, 'provider');
        const price = input?.price;
        if (typeof price !== 'number' || !Number.isFinite(price) || price < 0) {
            throw new BadRequestException(
                'price must be a non-negative number',
            );
        }

        const { rows } = await this.pool.query<Usage>(
            `INSERT INTO usages (owner_id, pet_id, service_id, service_title, provider, price)
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING ${USAGE_COLUMNS}`,
            [ownerId, petId, serviceId, serviceTitle, provider, price],
        );
        return rows[0];
    }

    async listForOwner(ownerId: number): Promise<Usage[]> {
        const { rows } = await this.pool.query<Usage>(
            `SELECT ${USAGE_COLUMNS} FROM usages
             WHERE owner_id = $1
             ORDER BY created_at DESC, id DESC`,
            [ownerId],
        );
        return rows;
    }

    async get(id: number): Promise<Usage> {
        const { rows } = await this.pool.query<Usage>(
            `SELECT ${USAGE_COLUMNS} FROM usages WHERE id = $1`,
            [id],
        );
        if (!rows[0]) throw new NotFoundException(`Usage ${id} not found`);
        return rows[0];
    }

    // Only a booked usage can move on, and only to completed or cancelled.
    async updateStatus(
        id: number,
        input: Record<string, unknown>,
    ): Promise<Usage> {
        const ownerId = positiveInteger(input?.ownerId, 'ownerId');
        const status = input?.status;
        if (status !== 'completed' && status !== 'cancelled') {
            throw new BadRequestException(
                "status must be 'completed' or 'cancelled'",
            );
        }

        const { rows } = await this.pool.query<Usage>(
            `UPDATE usages
             SET status = $3,
                 completed_at = CASE WHEN $3 = 'completed' THEN now() END,
                 updated_at = now()
             WHERE id = $1 AND owner_id = $2 AND status = 'booked'
             RETURNING ${USAGE_COLUMNS}`,
            [id, ownerId, status],
        );
        if (rows[0]) return rows[0];

        const existing = await this.get(id);
        if (existing.ownerId !== ownerId) {
            throw new NotFoundException(`Usage ${id} not found`);
        }
        throw new ConflictException(
            `Usage ${id} is already ${existing.status}`,
        );
    }
}
