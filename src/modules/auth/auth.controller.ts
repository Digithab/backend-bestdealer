import { Body, Controller, Post } from '@nestjs/common';
import { AuthService } from './auth.service';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {

    constructor(

        private authService: AuthService

    ) { }

    @Post('login')
    Login(@Body() body: Record<string, any>) {

        return this.authService.login(body.email, body.password)
    }
}
