import { IsEmail, IsNotEmpty, IsNumber, IsString, MAX_LENGTH, MaxLength } from "class-validator";



export class CreateUserDto {

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