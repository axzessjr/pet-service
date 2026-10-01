import { Injectable } from '@nestjs/common';

@Injectable()
export class UsersService {
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
