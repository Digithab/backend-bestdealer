import { forwardRef, Module } from '@nestjs/common';
import { OrdiniPachettiService } from './ordini_pachetti.service';
import { OrdiniPachettiController } from './ordini_pachetti.controller';
import { UsersModule } from 'src/modules/users/users.module';
import { LogModule } from 'src/modules/operation/log/log.module';
import { ProformaService } from 'src/modules/Fatture/proforma/proforma.service';
import { ProformaModule } from 'src/modules/Fatture/proforma/proforma.module';
import { OrdiniContrConsumoCardsModule } from '../ordini-contr-consumo-cards/ordini-contr-consumo-cards.module';
import { MailService } from 'src/mail/mail.service';
import { MailModule } from 'src/mail/mail.module';
import { GenPdfModule } from 'src/modules/gen-pdf/gen-pdf.module';
import { GenPdfService } from 'src/modules/gen-pdf/gen-pdf.service';
import { OrdiniContrConsumoCardsService } from '../ordini-contr-consumo-cards/ordini-contr-consumo-cards.service';
import { OrdiniContrConsumoService } from '../ordini-contr-consumo/ordini-contr-consumo.service';
import { FtpServiceModule } from 'src/ftp-service/ftp-service.module';
import { DisponibilitaPacchettiModule } from 'src/modules/Guarantees/disponibilita_pacchetti/disponibilita_pacchetti.module';


@Module({
  imports: [UsersModule, LogModule, forwardRef(() => ProformaModule), MailModule, GenPdfModule, forwardRef(() => OrdiniContrConsumoCardsModule), FtpServiceModule, DisponibilitaPacchettiModule],
  controllers: [OrdiniPachettiController],
  providers: [OrdiniPachettiService, ProformaService, MailService, GenPdfService, OrdiniContrConsumoService],
  exports: [OrdiniPachettiService]
})
export class OrdiniPachettiModule { }
