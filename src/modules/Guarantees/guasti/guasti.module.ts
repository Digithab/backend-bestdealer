import { Module } from '@nestjs/common';
import { GuastiService } from './guasti.service';
import { GuastiController } from './guasti.controller';
import { UsersModule } from 'src/modules/users/users.module';
import { FtpServiceModule } from 'src/ftp-service/ftp-service.module';

@Module({
  imports: [UsersModule, FtpServiceModule],
  controllers: [GuastiController],
  providers: [GuastiService],
})
export class GuastiModule { }
