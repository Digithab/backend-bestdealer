import { Module } from '@nestjs/common';
import { DisponibilitaPacchettiService } from './disponibilita_pacchetti.service';
import { DisponibilitaPacchettiController } from './disponibilita_pacchetti.controller';
import { UsersModule } from 'src/modules/users/users.module';
import { MailService } from 'src/mail/mail.service';
import { MailModule } from 'src/mail/mail.module';
import { FtpServiceModule } from 'src/ftp-service/ftp-service.module';

@Module({
  imports: [UsersModule, MailModule, FtpServiceModule],
  controllers: [DisponibilitaPacchettiController],
  providers: [DisponibilitaPacchettiService, MailService],
  exports: [DisponibilitaPacchettiService]
})
export class DisponibilitaPacchettiModule { }
