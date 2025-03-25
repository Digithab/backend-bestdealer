import { Module } from '@nestjs/common';
import { OrdiniPachettiCardsService } from './ordini_pachetti_cards.service';
import { OrdiniPachettiCardsController } from './ordini_pachetti_cards.controller';
import { ProformaService } from 'src/modules/Fatture/proforma/proforma.service';
import { UsersModule } from 'src/modules/users/users.module';
import { LogModule } from 'src/modules/operation/log/log.module';
import { OrdiniContrConsumoCardsModule } from '../ordini-contr-consumo-cards/ordini-contr-consumo-cards.module';
import { ProformaModule } from 'src/modules/Fatture/proforma/proforma.module';
import { MailService } from 'src/mail/mail.service';
import { MailModule } from 'src/mail/mail.module';
import { GenPdfModule } from 'src/modules/gen-pdf/gen-pdf.module';
import { GenPdfService } from 'src/modules/gen-pdf/gen-pdf.service';
import { OrdiniContrConsumoCardsService } from '../ordini-contr-consumo-cards/ordini-contr-consumo-cards.service';
import { OrdiniContrConsumoService } from '../ordini-contr-consumo/ordini-contr-consumo.service';
import { FtpServiceModule } from 'src/ftp-service/ftp-service.module';

@Module({
  imports: [UsersModule, LogModule, ProformaModule, OrdiniContrConsumoCardsModule, MailModule, GenPdfModule, FtpServiceModule],
  controllers: [OrdiniPachettiCardsController],
  providers: [OrdiniPachettiCardsService, ProformaService, MailService, GenPdfService, OrdiniContrConsumoService],
})
export class OrdiniPachettiCardsModule { }
