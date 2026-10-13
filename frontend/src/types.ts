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
        averageRating: number;
        reviewCount: number;
    }[];
};

export type RecommendationMatch = {
    serviceId: number;
    score: number;
    matchedNeeds: string[];
    averageRating: number;
    reviewCount: number;
};

export type UsageStatus = 'booked' | 'completed' | 'cancelled';

// One booking of a catalog service for a pet. Title, provider, and price are
// copied at booking time.
export type Usage = {
    id: number;
    ownerId: number;
    petId: number;
    serviceId: number;
    serviceTitle: string;
    provider: string;
    price: number;
    status: UsageStatus;
    completedAt: string | null;
    createdAt: string;
    updatedAt: string;
};

export type Review = {
    id: number;
    usageId: number;
    serviceId: number;
    ownerId: number;
    rating: number;
    comment: string;
    createdAt: string;
    updatedAt: string;
};

export type ServiceRating = {
    serviceId: number;
    averageRating: number;
    reviewCount: number;
};

export type SavedRecommendation = {
    id: string;
    petId: number;
    limit: number;
    matches: RecommendationMatch[];
    createdAt: string;
    updatedAt: string;
};
