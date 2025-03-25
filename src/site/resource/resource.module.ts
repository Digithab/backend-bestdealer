import { Module } from '@nestjs/common';
import { ResourceService } from './resource.service';
import { ResourceController } from './resource.controller';
import { FtpServiceModule } from 'src/ftp-service/ftp-service.module';
import { UsersModule } from 'src/modules/users/users.module';

@Module({
  imports: [FtpServiceModule, UsersModule],
  controllers: [ResourceController],
  providers: [ResourceService],
})
export class ResourceModule { }
