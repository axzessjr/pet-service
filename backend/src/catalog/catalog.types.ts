export interface CatalogItem {
    id: number;
    title: string;
    provider: string;
    price: number;
    category: string;
    species: string[];
    tags: string[];
    description: string;
}
