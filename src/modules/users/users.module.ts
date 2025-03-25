import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MailService } from 'src/mail/mail.service';
import { MailModule } from 'src/mail/mail.module';

@Module({
  imports: [TypeOrmModule.forFeature(), MailModule],
  controllers: [UsersController],
  providers: [UsersService, MailService],
  exports: [UsersService]
})
export class UsersModule { }
