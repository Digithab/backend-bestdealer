import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user-dto';

@Controller('users')
export class UsersController {

    constructor(
        private readonly UsersService: UsersService
    ) { }

    // @Post()
    // create(@Body() createUserDto: CreateUserDto) {
    //     return this.UsersService.create(createUserDto);
    // }

    // @Get()
    // findAll() {
    //     return this.UsersService.findAll();
    // }

    // @Get(':id')
    // findOne(@Param('id') id: number) {
    //     return this.UsersService.findOne(+id);
    // }

    // @Patch(':id')
    // update(@Param('id') id: number, @Body() updateUserDto: UpdateUserDto) {
    //     return this.UsersService.update(+id, updateUserDto);
    // }

    // @Delete(':id')
    // remove(@Param('id') id: number) {
    //     return this.UsersService.remove(+id);
    // }
}
