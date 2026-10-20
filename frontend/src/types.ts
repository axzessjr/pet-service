export type CatalogLocation = {
    lat: number;
    lng: number;
    address: string;
    district: string;
};

export type CatalogItem = {
    id: number;
    title: string;
    provider: string;
    price: number;
    category: string;
    species: string[];
    tags: string[];
    description: string;
    location: CatalogLocation;
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

export type AspectKey = 'quality' | 'value' | 'punctuality' | 'friendliness';

// Optional 1-5 ratings for parts of the visit.
export type Aspects = Partial<Record<AspectKey, number>>;

// A review stored in the review service (MongoDB). `service` and `pet` are
// copies taken when the review was written.
export type Review = {
    id: string;
    serviceId: number;
    service: { title: string; provider: string };
    ownerId: number;
    pet: { id: number; name: string; species: string } | null;
    rating: number;
    aspects: Aspects | null;
    title: string;
    comment: string;
    visitedOn: string | null;
    tags: string[];
    wouldRecommend: boolean | null;
    photos: { id: string; width: number; height: number }[];
    createdAt: string;
    updatedAt: string;
};

export type ServiceRating = {
    serviceId: number;
    averageRating: number;
    reviewCount: number;
    aspects: Record<AspectKey, number | null>;
    recommendPercent: number | null;
    photoCount: number;
};

export type SavedRecommendation = {
    id: string;
    petId: number;
    limit: number;
    matches: RecommendationMatch[];
    createdAt: string;
    updatedAt: string;
};
