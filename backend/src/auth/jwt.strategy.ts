import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

export const JWT_SECRET =
    process.env.JWT_SECRET ?? 'pawpal-dev-jwt-secret-change-in-production';

export interface JwtPayload {
    sub: number;
    email: string;
    iat?: number;
    exp?: number;
}

export interface AuthenticatedUser {
    userId: number;
    email: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
    constructor() {
        super({
            jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
            ignoreExpiration: false,
            secretOrKey: JWT_SECRET,
        });
    }

    validate(payload: JwtPayload): AuthenticatedUser {
        const userId = Number(payload?.sub);
        if (
            !Number.isSafeInteger(userId) ||
            userId <= 0 ||
            typeof payload?.email !== 'string' ||
            !payload.email
        ) {
            throw new UnauthorizedException('Invalid token payload');
        }
        return {
            userId,
            email: payload.email,
        };
    }
}
