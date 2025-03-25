import { Module } from '@nestjs/common';
import { FtpServiceService } from './ftp-service.service';
import { FtpServiceController } from './ftp-service.controller';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [ConfigModule],
  controllers: [FtpServiceController],
  providers: [FtpServiceService],
  exports: [FtpServiceService]
})
export class FtpServiceModule { }
