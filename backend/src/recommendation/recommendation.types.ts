import { CatalogItem } from '../catalog/catalog.types';
import { Pet } from '../pet-profile/pet-profile.types';

export interface Recommendation {
    service: CatalogItem;
    score: number;
    matchedNeeds: string[];
    averageRating: number;
    reviewCount: number;
}

export interface PetRecommendations {
    pet: Pet;
    recommendations: Recommendation[];
}

export interface MapBounds {
    minLat: number;
    minLng: number;
    maxLat: number;
    maxLng: number;
}

// "detail": every ranked service in view. "top": only the best few, because
// the map is zoomed out.
export type MapMode = 'detail' | 'top';

export interface MapRecommendation extends Recommendation {
    // False for services that cover none of the pet's needs; they are only
    // returned with includeUnmatched and always rank last, with score 0.
    matched: boolean;
}

export interface MapRecommendations {
    pet: Pet;
    mode: MapMode;
    bounds: MapBounds;
    zoom: number;
    // The zoom at which the map switches from "top" to "detail".
    detailZoom: number;
    // Services that fit the area and filters, before the top-N or limit cut.
    total: number;
    recommendations: MapRecommendation[];
    // Only when nothing fits and the price limit is why.
    overBudget?: OverBudget;
}

export interface OverBudget {
    // Services in the area that fit the pet and filters but cost more.
    count: number;
    cheapestPrice: number;
    // The limit that hid them: the pet's budget or a lower maxPrice filter.
    maxPrice: number;
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
    // 0 when the service has no reviews.
    averageRating: number;
    reviewCount: number;
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
