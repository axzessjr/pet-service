import {
    BadRequestException,
    Inject,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { Pool } from 'pg';
import { PG_CONNECTION } from '../database/database.module';

import { Pet, PetInput } from './pet-profile.types';

@Injectable()
export class PetProfileService {
    constructor(@Inject(PG_CONNECTION) private readonly pool: Pool) {}

    // 1. Fetch pets belonging to a specific user
    async getProfile(userId: string | number | undefined): Promise<Pet[]> {
        if (!userId) return [];

        const sql = `
            SELECT ${PET_COLUMNS}
            FROM pets
            WHERE user_id = $1
            ORDER BY id ASC
        `;

        const { rows } = await this.pool.query<Pet>(sql, [userId]);

        return rows;
    }

    // 2. Fetch a single pet by its ID (used by the Recommendation engine)
    async getPetById(id: number): Promise<Pet | undefined> {
        const sql = `
            SELECT ${PET_COLUMNS}
            FROM pets
            WHERE id = $1
            LIMIT 1
        `;
        const { rows } = await this.pool.query<Pet>(sql, [id]);
        return rows[0];
    }

    // 3. Create a new pet for a user
    async createPet(input: PetInput): Promise<Pet> {
        const pet = this.validatePetInput(input);

        const sql = `
            INSERT INTO pets (user_id, name, species, needs, max_price)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING ${PET_COLUMNS}
        `;
        const { rows } = await this.pool.query<Pet>(sql, [
            pet.userId,
            pet.name,
            pet.species,
            pet.needs,
            pet.maxPrice,
        ]);
        return rows[0];
    }

    // 4. Update a pet (only if it belongs to the given user)
    async updatePet(id: number, input: PetInput): Promise<Pet> {
        const pet = this.validatePetInput(input);

        const sql = `
            UPDATE pets
            SET name = $3, species = $4, needs = $5, max_price = $6
            WHERE id = $1 AND user_id = $2
            RETURNING ${PET_COLUMNS}
        `;
        const { rows } = await this.pool.query<Pet>(sql, [
            id,
            pet.userId,
            pet.name,
            pet.species,
            pet.needs,
            pet.maxPrice,
        ]);
        if (!rows[0]) throw new NotFoundException(`Pet ${id} not found`);
        return rows[0];
    }

    // 5. Delete a pet (only if it belongs to the given user)
    async deletePet(
        id: number,
        userId: string | number | undefined,
    ): Promise<{ id: number }> {
        if (!userId) throw new BadRequestException('userId is required');

        const { rowCount } = await this.pool.query(
            'DELETE FROM pets WHERE id = $1 AND user_id = $2',
            [id, userId],
        );
        if (!rowCount) throw new NotFoundException(`Pet ${id} not found`);
        return { id };
    }

    private validatePetInput(input: Partial<PetInput>): PetInput {
        const name = input?.name?.trim();
        const species = input?.species?.trim().toLowerCase();
        const maxPrice = Number(input?.maxPrice ?? DEFAULT_MAX_PRICE);
        // Catalog tags are lowercase, and the recommender compares them
        // without case, so store needs the same way, once each.
        const needs = Array.isArray(input?.needs)
            ? [
                  ...new Set(
                      input.needs
                          .map((n) => String(n).trim().toLowerCase())
                          .filter(Boolean),
                  ),
              ]
            : [];

        if (!input?.userId) throw new BadRequestException('userId is required');
        if (!name) throw new BadRequestException('name is required');
        if (!species) throw new BadRequestException('species is required');
        if (!Number.isFinite(maxPrice) || maxPrice < 0) {
            throw new BadRequestException(
                'maxPrice must be a non-negative number',
            );
        }

        return { userId: input.userId, name, species, needs, maxPrice };
    }
}

// Budget in baht for a pet created without one. 0 means no limit.
const DEFAULT_MAX_PRICE = 2000;

const PET_COLUMNS = `
    id::int AS id,
    user_id::int AS "userId",
    name,
    species,
    needs,
    max_price::float AS "maxPrice"
`;
