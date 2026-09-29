import { Controller, Get } from '@nestjs/common';
import { CatalogService } from './catalog.service';

// The '@Controller('catalog')' means this handles any URL starting with /catalog
@Controller('catalog')
export class CatalogController {
    // We inject the service so we can use its data
    constructor(private readonly catalogService: CatalogService) {}

    // This handles GET requests to /catalog
    @Get()
    getAllItems() {
        return this.catalogService.getCatalogItems();
    }
}
