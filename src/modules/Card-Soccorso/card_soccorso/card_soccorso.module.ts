import { Module } from '@nestjs/common';
import { CardSoccorsoService } from './card_soccorso.service';
import { CardSoccorsoController } from './card_soccorso.controller';
import { UsersModule } from 'src/modules/users/users.module';
import { DisponibilitaPacchettiCardModule } from '../disponibilita_pacchetti_card/disponibilita_pacchetti_card.module';
import { OrdiniContrConsumoCardsModule } from 'src/modules/ordini/ordini-contr-consumo-cards/ordini-contr-consumo-cards.module';
import { GenPdfService } from 'src/modules/gen-pdf/gen-pdf.service';
import { GenPdfModule } from 'src/modules/gen-pdf/gen-pdf.module';
import { FtpServiceModule } from 'src/ftp-service/ftp-service.module';
import { ProformaModule } from 'src/modules/Fatture/proforma/proforma.module';

@Module({
  imports: [UsersModule, DisponibilitaPacchettiCardModule, OrdiniContrConsumoCardsModule, GenPdfModule, FtpServiceModule, ProformaModule],
  controllers: [CardSoccorsoController],
  providers: [CardSoccorsoService],
})
export class CardSoccorsoModule { }
