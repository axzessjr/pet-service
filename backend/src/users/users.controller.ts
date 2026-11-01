import { Body, Controller, Param, ParseIntPipe, Patch } from '@nestjs/common';
import { UsersService } from './users.service';
import type { UpdateAccountInput } from './users.service';

@Controller('users')
export class UsersController {
    constructor(private readonly usersService: UsersService) {}

    // PATCH /users/:id  { firstname, lastname, email }
    // Returns the account as login does: { id, firstname, lastname, email }.
    @Patch(':id')
    update(
        @Param('id', ParseIntPipe) id: number,
        @Body() body: UpdateAccountInput,
    ) {
        return this.usersService.updateAccount(id, body);
    }
}
