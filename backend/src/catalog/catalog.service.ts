import { Inject, Injectable } from '@nestjs/common';
import { Pool } from 'pg';
import { PG_CONNECTION } from '../database/database.module';
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
    constructor(@Inject(PG_CONNECTION) private readonly pool: Pool) {}

    async getCatalogItems(): Promise<CatalogItem[]> {
        const { rows } = await this.pool.query<CatalogItem>(
            'SELECT id, title, provider, price, category, species, tags, description, location ' +
                'FROM public.catalog_services ORDER BY id',
        );
        return rows;
    }

    async search({ q, category }: CatalogSearch): Promise<CatalogItem[]> {
        const catalog = await this.getCatalogItems();
        return catalog.filter(
            (item) =>
                (q === undefined || matchesText(item, q)) &&
                (category === undefined || matchesCategory(item, category)),
        );
    }
}
