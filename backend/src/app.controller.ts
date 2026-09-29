import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
    constructor(private readonly appService: AppService) {}

    // We changed this route to be accessible at http://localhost:3000/api/pets
    @Get('/api/pets')
    getPets() {
        return this.appService.getPets();
    }
}
