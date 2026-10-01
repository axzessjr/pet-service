import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Pool } from 'pg';
import { PG_CONNECTION } from '../database/database.module';

import { Pet, PetInput } from './pet-profile.types';

@Injectable()
export class PetProfileService {
    constructor(@Inject(PG_CONNECTION) private readonly pool: Pool) { }

    // 1. Fetch pets belonging to a specific user
    async getProfile(userId: any) {
        if (!userId) return [];

        const sql = `
            SELECT ${PET_COLUMNS}
            FROM pets
            WHERE user_id = $1
            ORDER BY id ASC
        `;

        const { rows } = await this.pool.query(sql, [userId])

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
        const { rows } = await this.pool.query(sql, [id]);
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
        const { rows } = await this.pool.query(sql, [
            pet.userId, pet.name, pet.species, pet.needs, pet.maxPrice,
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
        const { rows } = await this.pool.query(sql, [
            id, pet.userId, pet.name, pet.species, pet.needs, pet.maxPrice,
        ]);
        if (!rows[0]) throw new NotFoundException(`Pet ${id} not found`);
        return rows[0];
    }

    // 5. Delete a pet (only if it belongs to the given user)
    async deletePet(id: number, userId: any): Promise<{ id: number }> {
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
        const maxPrice = Number(input?.maxPrice ?? 0);
        const needs = Array.isArray(input?.needs)
            ? input.needs.map((n) => String(n).trim()).filter(Boolean)
            : [];

        if (!input?.userId) throw new BadRequestException('userId is required');
        if (!name) throw new BadRequestException('name is required');
        if (!species) throw new BadRequestException('species is required');
        if (!Number.isFinite(maxPrice) || maxPrice < 0) {
            throw new BadRequestException('maxPrice must be a non-negative number');
        }

        return { userId: input.userId, name, species, needs, maxPrice };
    }

}

const PET_COLUMNS = `
    id::int AS id,
    user_id::int AS "userId",
    name,
    species,
    needs,
    max_price::float AS "maxPrice"
`;


/*
@Injectable()
export class PetProfileServiceLegacy {
    private readonly pets: Pet[] = [
        {
            id: 1,
            name: 'Luna',
            species: 'cat',
            needs: ['coat-care', 'low-stress'],
            maxPrice: 50,
            userId: 1
        },
        {
            id: 2,
            name: 'Max',
            species: 'dog',
            needs: ['exercise', 'social'],
            maxPrice: 45,
            userId: 2
        },
        {
            id: 3,
            name: 'Milo',
            species: 'cat',
            needs: ['play', 'companionship'],
            maxPrice: 35,
            userId: 2
        },
        {
            id: 4,
            name: 'Bella',
            species: 'dog',
            needs: ['gentle-exercise', 'low-stress'],
            maxPrice: 35,
            userId: 2
        },
    ];

    getProfile(userId?: any): Pet[] | null {
        const userPets = (userId)
            ? this.pets.filter((pet) => pet.userId === parseInt(userId))
            : [];

        return userPets;
    }

    getPetById(id: number): Pet | undefined {
        return this.pets.find((pet) => pet.id === id);
    }
}
*/
