export interface CatalogLocation {
    lat: number;
    lng: number;
    address: string;
    // The neighbourhood, e.g. "Samyan" or "Silom".
    district: string;
}

export interface CatalogItem {
    id: number;
    title: string;
    provider: string;
    price: number;
    category: string;
    species: string[];
    tags: string[];
    description: string;
    location: CatalogLocation;
}

export interface CatalogSearch {
    q?: string;
    category?: string;
}
