export type CatalogItem = {
    id: number;
    title: string;
    provider: string;
    price: number;
    category: string;
    species: string[];
    tags: string[];
    description: string;
};

export type Pet = {
    id: number;
    name: string;
    species: string;
    needs: string[];
    maxPrice: number;
};

export type UserProfile = {
    name: string;
    email: string;
    pets: Pet[];
};

export type PetRecommendations = {
    pet: Pet;
    recommendations: {
        service: CatalogItem;
        score: number;
        matchedNeeds: string[];
    }[];
};

export type RecommendationMatch = {
    serviceId: number;
    score: number;
    matchedNeeds: string[];
};

export type SavedRecommendation = {
    id: string;
    petId: number;
    limit: number;
    matches: RecommendationMatch[];
    createdAt: string;
    updatedAt: string;
};
