import { forwardRef, Module } from '@nestjs/common';
import { GaranzieService } from './garanzie.service';
import { GaranzieController } from './garanzie.controller';
import { UsersModule } from 'src/modules/users/users.module';
import { DisponibilitaPacchettiModule } from '../disponibilita_pacchetti/disponibilita_pacchetti.module';
import { FtpServiceModule } from 'src/ftp-service/ftp-service.module';
import { ProformaService } from 'src/modules/Fatture/proforma/proforma.service';
import { ProformaModule } from 'src/modules/Fatture/proforma/proforma.module';
import { OrdiniContrConsumoCardsService } from 'src/modules/ordini/ordini-contr-consumo-cards/ordini-contr-consumo-cards.service';
import { MailService } from 'src/mail/mail.service';
import { MailModule } from 'src/mail/mail.module';
import { GenPdfModule } from 'src/modules/gen-pdf/gen-pdf.module';
import { GenPdfService } from 'src/modules/gen-pdf/gen-pdf.service';
import { OrdiniContrConsumoCardsModule } from 'src/modules/ordini/ordini-contr-consumo-cards/ordini-contr-consumo-cards.module';
import { OrdiniContrConsumoService } from 'src/modules/ordini/ordini-contr-consumo/ordini-contr-consumo.service';

@Module({
  imports: [UsersModule, DisponibilitaPacchettiModule, FtpServiceModule, ProformaModule, MailModule, GenPdfModule, OrdiniContrConsumoCardsModule],
  controllers: [GaranzieController],
  providers: [GaranzieService, ProformaService, OrdiniContrConsumoCardsService, MailService, GenPdfService, OrdiniContrConsumoService],
  exports: [GaranzieService]
})
export class GaranzieModule { }
