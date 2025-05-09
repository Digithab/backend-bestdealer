import { forwardRef, Module } from '@nestjs/common';
import { OrdiniContrConsumoService } from './ordini-contr-consumo.service';
import { OrdiniContrConsumoController } from './ordini-contr-consumo.controller';
import { UsersModule } from 'src/modules/users/users.module';
import { ProformaService } from 'src/modules/Fatture/proforma/proforma.service';
import { ProformaModule } from 'src/modules/Fatture/proforma/proforma.module';
import { OrdiniContrConsumoCardsModule } from '../ordini-contr-consumo-cards/ordini-contr-consumo-cards.module';
import { MailService } from 'src/mail/mail.service';
import { MailModule } from 'src/mail/mail.module';
import { GenPdfModule } from 'src/modules/gen-pdf/gen-pdf.module';
import { GenPdfService } from 'src/modules/gen-pdf/gen-pdf.service';
import { FtpServiceModule } from 'src/ftp-service/ftp-service.module';

@Module({
  imports: [forwardRef(() => ProformaModule), UsersModule,MailModule, GenPdfModule, FtpServiceModule, forwardRef(() => OrdiniContrConsumoCardsModule)],
  controllers: [OrdiniContrConsumoController],
  providers: [OrdiniContrConsumoService, ProformaService, MailService, GenPdfService],
  exports: [OrdiniContrConsumoService]
})
export class OrdiniContrConsumoModule { }
