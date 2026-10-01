import { Injectable, UnauthorizedException } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { LoginDTO } from './auth.controller';

@Injectable()
export class AuthService {

    constructor(private readonly usersService: UsersService) { }

    // Add async here
    async login(loginDto: LoginDTO) {
        // Add await here
        const user = await this.usersService.findByUsername(loginDto.username);

        if (user && user.password === loginDto.password) {
            return {
                message: 'Login successful!',
                user: {
                    id: user.id,
                    firstname: user.firstname,
                    lastname: user.lastname,
                    email: user.email
                }
            };
        }

        throw new UnauthorizedException('Invalid username or password');

    }

}
