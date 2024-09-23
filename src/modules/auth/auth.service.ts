import { JwtService } from '@nestjs/jwt';
import { UsersService } from './../users/users.service';
import { BadRequestException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';


@Injectable()
export class AuthService {

    constructor(

        private usersService: UsersService,

        private jwtService: JwtService,

    ) { }

    async validateUser(email: string, password: string) {

        const user = await this.usersService.findLogin(email)

        if (user && bcrypt.compare(password, user.password)) {

            const { password, ...result } = user

            return result;

        }

        return null

    }

    async login(email: string | null | undefined, password: string) {

        await this.validation(email, password)

        const user = await this.validateUser(email, password);

        if (!user) throw new UnauthorizedException('Invalid credencials');

        const payload = { email: user.email, sub: user.id }

        return {
            access_token: this.jwtService.sign(payload)
        }
    }

    async validation(email: string | null | undefined, password: string | null | undefined) {

        const trimmedEmail = email?.trim();

        const trimmedPass = password?.trim();

        if (email === null || email === undefined) throw new BadRequestException('E-mail richiesta!');

        if (password === null || password === undefined) throw new BadRequestException('Password richiesta!');


        if (trimmedEmail.length === 0) {
            throw new BadRequestException('E-mail non può essere vuota!');
        }

        if (trimmedPass.length === 0) {
            throw new BadRequestException('Password non può essere vuota!');
        }
    }

}
