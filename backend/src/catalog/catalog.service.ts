import { Injectable } from '@nestjs/common';
import { CATALOG } from './catalog.data';
import { CatalogItem, CatalogSearch } from './catalog.types';

// Case-insensitive match on the fields people search by, including tags in
// either "coat-care" or "coat care" form.
export function matchesText(item: CatalogItem, q: string): boolean {
    const needle = q.trim().toLowerCase();
    if (!needle) return true;
    const haystack = [
        item.title,
        item.provider,
        item.description,
        item.category,
        item.location.district,
        item.location.address,
        ...item.tags,
        ...item.tags.map((tag) => tag.replaceAll('-', ' ')),
    ]
        .join('\n')
        .toLowerCase();
    return haystack.includes(needle);
}

export function matchesCategory(item: CatalogItem, category: string): boolean {
    const wanted = category.trim().toLowerCase();
    return !wanted || item.category.toLowerCase() === wanted;
}

@Injectable()
export class CatalogService {
    private readonly catalog: CatalogItem[] = CATALOG;

    getCatalogItems(): CatalogItem[] {
        return this.catalog;
    }

    search({ q, category }: CatalogSearch): CatalogItem[] {
        return this.catalog.filter(
            (item) =>
                (q === undefined || matchesText(item, q)) &&
                (category === undefined || matchesCategory(item, category)),
        );
    }
}
