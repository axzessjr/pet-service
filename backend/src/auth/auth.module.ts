import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { JWT_SECRET, JwtStrategy } from './jwt.strategy';
import { UsersService } from '../users/users.service';

@Module({
    imports: [
        PassportModule.register({ defaultStrategy: 'jwt' }),
        JwtModule.register({
            secret: JWT_SECRET,
            signOptions: { expiresIn: '7d' },
        }),
    ],
    controllers: [AuthController],
    providers: [AuthService, UsersService, JwtStrategy, JwtAuthGuard],
    exports: [
        AuthService,
        JwtStrategy,
        JwtAuthGuard,
        JwtModule,
        PassportModule,
    ],
})
export class AuthModule {}
