import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
    getPets() {
        // This acts like a fake database for now!
        return [
            { id: 1, name: 'Buddy', species: 'Dog', age: 3 },
            { id: 2, name: 'Luna', species: 'Cat', age: 2 },
            { id: 3, name: 'Charlie', species: 'Dog', age: 5 },
        ];
    }
}
