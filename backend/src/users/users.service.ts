import { Inject, Injectable } from '@nestjs/common';
import { Pool } from 'pg';
import { PG_CONNECTION } from 'src/database/database.module';

@Injectable()
export class UsersService {
    // Inject the database pool
    constructor(@Inject(PG_CONNECTION) private readonly pool: Pool) { }

    // Query the users table using async/await
    async findByUsername(username: string) {
        const sql = "SELECT * FROM users WHERE email = $1 LIMIT 1";

        const { rows } = await this.pool.query(sql, [username]);

        return rows[0];
    }
}

/*
export class UsersServiceLegacy {
    // Assume that getting user list from database
    private users = [
        {
            "id": 1,
            "firstname": "Steve",
            "lastname": "Musk",
            "nickname": "Elon",
            "email": "admin",
            "password": "1234"
        },
        {
            "id": 2,
            "firstname": "Krittanon",
            "lastname": "Yuangthong",
            "nickname": "Jobs",
            "email": "axzess@gmail.com",
            "password": "1234"
        },
    ]

    findByUsername(username: string) {
        const foundedUser = this.users.find((user) => user.email === username)

        return foundedUser;
    }
}
*/