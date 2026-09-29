import { Injectable } from '@nestjs/common';

@Injectable()
export class PetProfileService {
    getProfile() {
        // This acts like we fetched the logged-in user from a database!
        return {
            name: 'Jane Doe',
            email: 'jane.doe@example.com',
            pets: [
                { id: 1, name: 'Luna', species: 'Cat' },
                { id: 2, name: 'Max', species: 'Dog' },
            ],
        };
    }
}
