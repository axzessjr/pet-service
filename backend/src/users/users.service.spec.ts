import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service';
import { PG_CONNECTION } from '../database/database.module';

describe('UsersService', () => {
    let service: UsersService;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [UsersService, { provide: PG_CONNECTION, useValue: {} }],
        }).compile();

        service = module.get<UsersService>(UsersService);
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });
});
