import { Injectable } from '@nestjs/common';
import { Pet } from './pet-profile.types';

@Injectable()
export class PetProfileService {
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
