import { Controller, Delete, Get, Post } from '@nestjs/common';
import { DiscoveryModule } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { GatewayService, LOCAL_SERVICE } from './gateway.service';
import { Upstream } from './upstreams';

@Upstream('review')
@Controller('reviews')
class ReviewsStub {
    @Get()
    list() {}

    @Delete(':id')
    remove() {}

    helper() {}
}

@Controller('auth')
class AuthStub {
    @Post('/login')
    login() {}
}

describe('GatewayService', () => {
    let gateway: GatewayService;

    beforeEach(async () => {
        const moduleRef = await Test.createTestingModule({
            imports: [DiscoveryModule],
            controllers: [ReviewsStub, AuthStub],
            providers: [GatewayService],
        }).compile();
        gateway = moduleRef.get(GatewayService);
    });

    it('lists every route with the service that answers it', () => {
        expect(gateway.routes()).toEqual([
            {
                method: 'POST',
                path: '/auth/login',
                service: LOCAL_SERVICE,
                protocol: 'in-process',
            },
            {
                method: 'GET',
                path: '/reviews',
                service: 'review',
                protocol: 'http',
            },
            {
                method: 'DELETE',
                path: '/reviews/:id',
                service: 'review',
                protocol: 'http',
            },
        ]);
    });

    it('lists the upstream services and the gateway itself', () => {
        expect(gateway.services().map((service) => service.name)).toEqual([
            'review',
            'recommender',
            LOCAL_SERVICE,
        ]);
    });
});
