import { Controller, Get, Req } from '@nestjs/common';
import type { Request } from 'express';
import { GatewayService } from './gateway.service';

@Controller('gateway')
export class GatewayController {
    constructor(private readonly gateway: GatewayService) {}

    // Lists the upstream services and every route, like Kong's admin API.
    // `gateway` is the address this request came in on, e.g. your LAN IP.
    @Get('routes')
    routes(@Req() request: Request) {
        return {
            gateway: `${request.protocol}://${request.get('host')}`,
            services: this.gateway.services(),
            routes: this.gateway.routes(),
        };
    }
}
