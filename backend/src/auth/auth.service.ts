import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { UsersService } from '../users/users.service';
import type { Account } from '../users/users.service';
import type { LoginDTO } from './auth.controller';
import type { JwtPayload } from './jwt.strategy';

export interface LoginResponse {
    message: string;
    access_token: string;
    user: Account;
}

@Injectable()
export class AuthService {
    constructor(
        private readonly usersService: UsersService,
        private readonly jwtService: JwtService,
    ) {}

    // Add async here
    async login(loginDto: LoginDTO): Promise<LoginResponse> {
        // Add await here
        const user = await this.usersService.findByUsername(loginDto.username);

        if (
            user &&
            typeof loginDto.password === 'string' &&
            (await bcrypt.compare(loginDto.password, user.password))
        ) {
            const payload: JwtPayload = {
                sub: Number(user.id),
                email: user.email,
            };
            const access_token = await this.jwtService.signAsync(payload);

            return {
                message: 'Login successful!',
                access_token,
                user: {
                    id: user.id,
                    firstname: user.firstname,
                    lastname: user.lastname,
                    email: user.email,
                },
            };
        }

        throw new UnauthorizedException('Invalid username or password');
    }
}
