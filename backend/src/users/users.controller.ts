import { Controller, Get, Post, Body, Patch, Param, Delete, } from '@nestjs/common';
import { UsersService } from './users.service';

interface CreateUserDto {
    firstname: string,
    lastname: string,
    nickname: string,
    email: string,
    password: string
}

interface UpdateUserDto {
    firstname: string,
    lastname: string,
    nickname: string
}

@Controller('users')
export class UsersController {
    constructor(private readonly usersService: UsersService) { }


    // @Post()
    // create(@Body() createUserDto: CreateUserDto) {
    //     return this.usersService.create();
    // }

    // @Get()
    // findAll() {
    //     return this.usersService.findAll();
    // }

    // @Get(':id')
    // findOne(@Param('id') id: string) {
    //     return this.usersService.findOne(+id);
    // }

    // @Patch(':id')
    // update(@Param('id') id: string, @Body() updateUserDto: UpdateUserDto) {
    //     //return this.usersService.update(+id, updateUserDto);

    // }

    // @Delete(':id')
    // remove(@Param('id') id: string) {
    //     return this.usersService.remove(+id);
    // }
}
