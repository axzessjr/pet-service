import { Controller, Post, Body } from '@nestjs/common';
import { AuthService } from './auth.service';

export interface LoginDTO {
    username: string,
    password: string
}

@Controller('auth')
export class AuthController {
    constructor(private readonly authService: AuthService) { }

    @Post('/login')
    requestLogin(@Body() loginDto: LoginDTO) {
        return this.authService.login(loginDto);
    }


}
