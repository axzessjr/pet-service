import {
    Body,
    Controller,
    Get,
    Param,
    ParseIntPipe,
    Patch,
    Post,
    Query,
} from '@nestjs/common';
import { positiveIntegerParam } from '../common/validation';
import { UsagesService } from './usages.service';

@Controller('usages')
export class UsagesController {
    constructor(private readonly usagesService: UsagesService) {}

    @Post()
    create(@Body() body: Record<string, unknown>) {
        return this.usagesService.create(body);
    }

    @Get()
    list(@Query('ownerId') ownerId: string) {
        return this.usagesService.listForOwner(
            positiveIntegerParam(ownerId, 'ownerId'),
        );
    }

    @Get(':id')
    get(@Param('id', ParseIntPipe) id: number) {
        return this.usagesService.get(id);
    }

    @Patch(':id')
    updateStatus(
        @Param('id', ParseIntPipe) id: number,
        @Body() body: Record<string, unknown>,
    ) {
        return this.usagesService.updateStatus(id, body);
    }
}
