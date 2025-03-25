import { Module } from '@nestjs/common';
import { DealerService } from './dealer.service';
import { DealerController } from './dealer.controller';
import { UsersModule } from '../users/users.module';
import { FtpServiceModule } from 'src/ftp-service/ftp-service.module';

@Module({
  imports: [UsersModule, FtpServiceModule],
  controllers: [DealerController],
  providers: [DealerService],
})
export class DealerModule { }
