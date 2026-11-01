import {
    BadRequestException,
    ConflictException,
    Inject,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { Pool } from 'pg';
import { PG_CONNECTION } from '../database/database.module';

export interface UpdateAccountInput {
    firstname?: unknown;
    lastname?: unknown;
    email?: unknown;
}

export interface Account {
    // node-postgres returns BIGINT IDs as strings and INTEGER IDs as numbers.
    id: number | string;
    firstname: string;
    lastname: string;
    email: string;
}

interface LoginAccount extends Account {
    password: string;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function requiredText(value: unknown, label: string, max: number): string {
    const text = typeof value === 'string' ? value.trim() : '';
    if (!text) throw new BadRequestException(`Enter your ${label}.`);
    if (text.length > max) {
        throw new BadRequestException(
            `Your ${label} can be at most ${max} characters.`,
        );
    }
    return text;
}

@Injectable()
export class UsersService {
    // Inject the database pool
    constructor(@Inject(PG_CONNECTION) private readonly pool: Pool) {}

    // Query the users table using async/await
    async findByUsername(username: string): Promise<LoginAccount | undefined> {
        const sql = 'SELECT * FROM users WHERE email = $1 LIMIT 1';

        const { rows } = await this.pool.query<LoginAccount>(sql, [username]);

        return rows[0];
    }

    // Name and email. The email is also the login username.
    async updateAccount(
        id: number,
        input: UpdateAccountInput,
    ): Promise<Account> {
        const firstname = requiredText(input?.firstname, 'first name', 100);
        const lastname = requiredText(input?.lastname, 'last name', 100);
        const email = requiredText(input?.email, 'email', 254);
        if (!EMAIL_PATTERN.test(email)) {
            throw new BadRequestException(
                'Enter an email like name@example.com.',
            );
        }

        const taken = await this.pool.query<{ '?column?': number }>(
            'SELECT 1 FROM users WHERE lower(email) = lower($1) AND id <> $2 LIMIT 1',
            [email, id],
        );
        if (taken.rows.length > 0) {
            throw new ConflictException(
                'This email is already used by another account.',
            );
        }

        try {
            const { rows } = await this.pool.query<Account>(
                `UPDATE users SET firstname = $1, lastname = $2, email = $3
                 WHERE id = $4
                 RETURNING id, firstname, lastname, email`,
                [firstname, lastname, email, id],
            );
            if (rows.length === 0)
                throw new NotFoundException('Account not found.');
            return rows[0];
        } catch (error) {
            // A unique index on email, if the table has one, can still race.
            if ((error as { code?: string })?.code === '23505') {
                throw new ConflictException(
                    'This email is already used by another account.',
                );
            }
            throw error;
        }
    }
}
