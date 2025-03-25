import { Module } from '@nestjs/common';
import { GenPdfService } from './gen-pdf.service';
import { GenPdfController } from './gen-pdf.controller';
import { FtpServiceService } from 'src/ftp-service/ftp-service.service';
import { FtpServiceModule } from 'src/ftp-service/ftp-service.module';

@Module({
  imports: [FtpServiceModule],
  controllers: [GenPdfController],
  providers: [GenPdfService],
  exports: [GenPdfService]
})
export class GenPdfModule { }
