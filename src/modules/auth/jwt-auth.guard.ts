import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Observable } from 'rxjs';
import * as request from 'supertest';
import { JwtService } from '@nestjs/jwt';
import { jwtConstants } from './constants';
import { UsersService } from '../users/users.service';

@Injectable()
export class JwtAuthGuard implements CanActivate {

  constructor(
    private jwtService: JwtService,
    private user: UsersService
  ) { }
  async canActivate(context: ExecutionContext): Promise<boolean> {

    const request = context.switchToHttp().getRequest();
    const token = this.extractTokenFromHeader(request);

    if (!token) {
      throw new UnauthorizedException();
    }

    try {
      const payload = await this.jwtService.verifyAsync(
        token,
        {
          secret: jwtConstants.secret
        }
      )


      const userName = payload.role === 'agente' ? payload.sigla : payload.email

      const user = await this.user.findByUsername(userName);

      if (!user) {
        throw new UnauthorizedException();
      }

      request.user = user;

    } catch (error) {
      throw new UnauthorizedException()
    }
    return true
  }

  private extractTokenFromHeader(request: Request) {
    //@ts-ignore
    const [type, token] = request.headers.authorization?.split(' ') ?? []

    return type === 'Bearer' ? token : undefined
  }
}
