import { Module } from '@nestjs/common';
import { DiscoveryModule } from '@nestjs/core';
import { GatewayController } from './gateway.controller';
import { GatewayService } from './gateway.service';

@Module({
    imports: [DiscoveryModule],
    controllers: [GatewayController],
    providers: [GatewayService],
})
export class GatewayModule {}
