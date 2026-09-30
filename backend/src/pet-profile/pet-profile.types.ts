export interface Pet {
    id: number;
    name: string;
    species: string;
    needs: string[];
    maxPrice: number;
}

export interface UserProfile {
    name: string;
    email: string;
    pets: Pet[];
}
