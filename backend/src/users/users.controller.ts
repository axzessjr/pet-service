import {
    Body,
    Controller,
    ForbiddenException,
    Param,
    ParseIntPipe,
    Patch,
    UseGuards,
} from '@nestjs/common';
import { CurrentUser, JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { AuthenticatedUser } from '../auth/jwt.strategy';
import { UsersService } from './users.service';
import type { UpdateAccountInput } from './users.service';

@UseGuards(JwtAuthGuard)
@Controller('users')
export class UsersController {
    constructor(private readonly usersService: UsersService) {}

    // PATCH /users/:id  { firstname, lastname, email }
    // Returns the account as login does: { id, firstname, lastname, email }.
    @Patch(':id')
    update(
        @Param('id', ParseIntPipe) id: number,
        @Body() body: UpdateAccountInput,
        @CurrentUser() user?: AuthenticatedUser,
    ) {
        if (user && user.userId !== id) {
            throw new ForbiddenException(
                'You can only update your own account.',
            );
        }
        return this.usersService.updateAccount(user?.userId ?? id, body);
    }
}
