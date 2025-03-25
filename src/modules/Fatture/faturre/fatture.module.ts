import { Module } from '@nestjs/common';
import { FattureController } from './fatture.controller';
import { UsersModule } from 'src/modules/users/users.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FattureService } from './fatture.service';
import { MailModule } from 'src/mail/mail.module';
import { ProformaModule } from '../proforma/proforma.module';
import { GenPdfModule } from 'src/modules/gen-pdf/gen-pdf.module';
import { FtpServiceModule } from 'src/ftp-service/ftp-service.module';

@Module({
  imports: [TypeOrmModule, UsersModule, MailModule, ProformaModule, GenPdfModule, FtpServiceModule],
  controllers: [FattureController],
  providers: [FattureService],
})
export class FattureModule { }
