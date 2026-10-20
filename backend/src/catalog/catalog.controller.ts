import { BadRequestException, Controller, Get, Query } from '@nestjs/common';
import { CatalogService } from './catalog.service';

const MAX_QUERY_LENGTH = 100;

function optionalText(name: string, value: unknown): string | undefined {
    if (value === undefined) return undefined;
    if (typeof value !== 'string' || value.length > MAX_QUERY_LENGTH) {
        throw new BadRequestException(
            `${name} must be text of at most ${MAX_QUERY_LENGTH} characters`,
        );
    }
    return value;
}

// The '@Controller('catalog')' means this handles any URL starting with /catalog
@Controller('catalog')
export class CatalogController {
    // We inject the service so we can use its data
    constructor(private readonly catalogService: CatalogService) {}

    // GET /catalog, optionally narrowed with ?q=groom&category=Grooming
    @Get()
    getAllItems(
        @Query('q') q?: unknown,
        @Query('category') category?: unknown,
    ) {
        const search = {
            q: optionalText('q', q),
            category: optionalText('category', category),
        };
        if (search.q === undefined && search.category === undefined) {
            return this.catalogService.getCatalogItems();
        }
        return this.catalogService.search(search);
    }
}
