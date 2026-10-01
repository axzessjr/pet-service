import { CatalogItem } from '../catalog/catalog.types';
import { Pet } from '../pet-profile/pet-profile.types';

export interface Recommendation {
    service: CatalogItem;
    score: number;
    matchedNeeds: string[];
}

export interface PetRecommendations {
    pet: Pet;
    recommendations: Recommendation[];
}

export interface RecommendationRequest {
    pet: { species: string; needs: string[]; maxPrice: number };
    services: {
        id: number;
        species: string[];
        tags: string[];
        price: number;
    }[];
    limit: number;
}

export interface RecommendationResponse {
    matches: RecommendationMatch[];
}

export interface RecommendationMatch {
    serviceId: number;
    score: number;
    matchedNeeds: string[];
}

export interface SavedRecommendation {
    id: string;
    petId: number;
    limit: number;
    matches: RecommendationMatch[];
    createdAt: string;
    updatedAt: string;
}

export interface ListRecommendationsResponse {
    recommendations: SavedRecommendation[];
}
