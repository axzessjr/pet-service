import { Inject, Injectable } from '@nestjs/common';
import { Pool } from 'pg';
import { PG_CONNECTION } from 'src/database/database.module';

import { Pet } from './pet-profile.types';

@Injectable()
export class PetProfileService {
    constructor(@Inject(PG_CONNECTION) private readonly pool: Pool) { }

    // 1. Fetch pets belonging to a specific user
    async getProfile(userId: any) {
        if (!userId) return [];

        const sql = `
            SELECT 
                id,
                user_id AS "userId",
                name,
                species,
                needs,
                max_price::float AS "maxPrice"
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
            SELECT 
                id, 
                user_id AS "userId", 
                name, 
                species, 
                needs, 
                max_price::float AS "maxPrice" 
            FROM pets 
            WHERE id = $1
            LIMIT 1
        `;
        const { rows } = await this.pool.query(sql, [id]);
        return rows[0];
    }

}


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
