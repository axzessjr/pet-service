import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service';
import { PG_CONNECTION } from '../database/database.module';

describe('UsersService', () => {
    let service: UsersService;
    const query = jest.fn();

    beforeEach(async () => {
        query.mockReset();
        const module: TestingModule = await Test.createTestingModule({
            providers: [UsersService, { provide: PG_CONNECTION, useValue: { query } }],
        }).compile();

        service = module.get<UsersService>(UsersService);
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    describe('updateAccount', () => {
        const valid = { firstname: ' Vi ', lastname: 'Chong', email: 'Vi@Example.com' };

        it('trims the fields and returns the account', async () => {
            query
                .mockResolvedValueOnce({ rows: [] })
                .mockResolvedValueOnce({
                    rows: [{ id: 7, firstname: 'Vi', lastname: 'Chong', email: 'Vi@Example.com' }],
                });

            await expect(service.updateAccount(7, valid)).resolves.toEqual({
                id: 7,
                firstname: 'Vi',
                lastname: 'Chong',
                email: 'Vi@Example.com',
            });
            expect(query.mock.calls[1][1]).toEqual(['Vi', 'Chong', 'Vi@Example.com', 7]);
        });

        it('rejects a blank name', async () => {
            await expect(service.updateAccount(7, { ...valid, firstname: '  ' }))
                .rejects.toBeInstanceOf(BadRequestException);
            expect(query).not.toHaveBeenCalled();
        });

        it('rejects a malformed email', async () => {
            await expect(service.updateAccount(7, { ...valid, email: 'not-an-email' }))
                .rejects.toBeInstanceOf(BadRequestException);
        });

        it('rejects an email another account uses', async () => {
            query.mockResolvedValueOnce({ rows: [{ '?column?': 1 }] });
            await expect(service.updateAccount(7, valid)).rejects.toBeInstanceOf(ConflictException);
        });

        it('reports a missing account', async () => {
            query.mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [] });
            await expect(service.updateAccount(99, valid)).rejects.toBeInstanceOf(NotFoundException);
        });
    });
});
