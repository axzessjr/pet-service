import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import * as bcrypt from 'bcryptjs';
import { AuthService } from './auth.service';
import { JwtStrategy } from './jwt.strategy';
import { UsersService } from '../users/users.service';

describe('AuthService & JwtStrategy', () => {
    let service: AuthService;
    const findByUsername = jest.fn();
    const signAsync = jest.fn();

    beforeEach(async () => {
        findByUsername.mockReset();
        signAsync.mockReset().mockResolvedValue('signed-jwt-token');

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                AuthService,
                { provide: UsersService, useValue: { findByUsername } },
                { provide: JwtService, useValue: { signAsync } },
            ],
        }).compile();

        service = module.get<AuthService>(AuthService);
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    it('verifies bcrypt password, signs a JWT token, and returns user details on valid login', async () => {
        const hashedPassword = await bcrypt.hash('secret', 10);
        findByUsername.mockResolvedValue({
            id: '7',
            firstname: 'Jane',
            lastname: 'Doe',
            email: 'jane@example.com',
            password: hashedPassword,
        });

        const result = await service.login({
            username: 'jane@example.com',
            password: 'secret',
        });

        expect(signAsync).toHaveBeenCalledWith({
            sub: 7,
            email: 'jane@example.com',
        });
        expect(result).toEqual({
            message: 'Login successful!',
            access_token: 'signed-jwt-token',
            user: {
                id: '7',
                firstname: 'Jane',
                lastname: 'Doe',
                email: 'jane@example.com',
            },
        });
    });

    it('throws UnauthorizedException on invalid credentials', async () => {
        findByUsername.mockResolvedValue(undefined);
        await expect(
            service.login({ username: 'none@example.com', password: 'wrong' }),
        ).rejects.toThrow(UnauthorizedException);
    });

    it('validates JWT payloads in JwtStrategy', () => {
        const strategy = new JwtStrategy();
        expect(
            strategy.validate({ sub: 7, email: 'jane@example.com' }),
        ).toEqual({
            userId: 7,
            email: 'jane@example.com',
        });
        expect(() =>
            strategy.validate({ sub: 0, email: 'jane@example.com' }),
        ).toThrow(UnauthorizedException);
    });
});
