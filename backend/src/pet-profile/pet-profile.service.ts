import { Injectable } from '@nestjs/common';
import { Pet, UserProfile } from './pet-profile.types';

@Injectable()
export class PetProfileService {
    private readonly profile: UserProfile = {
        name: 'Jane Doe',
        email: 'jane.doe@example.com',
        pets: [
            {
                id: 1,
                name: 'Luna',
                species: 'cat',
                needs: ['coat-care', 'low-stress'],
                maxPrice: 50,
            },
            {
                id: 2,
                name: 'Max',
                species: 'dog',
                needs: ['exercise', 'social'],
                maxPrice: 45,
            },
            {
                id: 3,
                name: 'Milo',
                species: 'cat',
                needs: ['play', 'companionship'],
                maxPrice: 35,
            },
            {
                id: 4,
                name: 'Bella',
                species: 'dog',
                needs: ['gentle-exercise', 'low-stress'],
                maxPrice: 35,
            },
        ],
    };

    getProfile(): UserProfile {
        return this.profile;
    }

    getPetById(id: number): Pet | undefined {
        return this.profile.pets.find((pet) => pet.id === id);
    }
}
