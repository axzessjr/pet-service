import { Injectable } from '@nestjs/common';

@Injectable()
export class CatalogService {
    private catalog = [
        {
            id: 101,
            title: 'Dog Walking (30 min)',
            provider: 'John Doe',
            price: 15,
        },
        {
            id: 102,
            title: 'Cat Grooming',
            provider: 'Jane Smith',
            price: 45,
        },
        {
            id: 103,
            title: 'Overnight Pet Sitting',
            provider: 'PetPal Care',
            price: 60,
        },
    ]


    getCatalogItems() {
        // This is our fake catalog database
        return this.catalog;
    }
}
