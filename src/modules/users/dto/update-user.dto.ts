import { IsEmail, IsNotEmpty, IsNumber, IsString, MaxLength } from "class-validator";
import { CreateUserDto } from "./create-user-dto";
import { PartialType } from '@nestjs/mapped-types';

export class UpdateUserDto extends PartialType(CreateUserDto) {

    @IsNotEmpty({ message: 'Field email must be added' })
    @IsEmail()
    @MaxLength(254)
    email: string

    @IsNotEmpty({ message: 'Field password must be added' })
    @IsString()
    @MaxLength(64)
    password: string

    @IsNotEmpty({ message: 'Field none must be added' })
    @IsString()
    @MaxLength(20)
    none: string

    @IsNotEmpty({ message: 'Field ruolo must be added' })
    @IsNumber()
    @MaxLength(1)
    ruolo: number

}