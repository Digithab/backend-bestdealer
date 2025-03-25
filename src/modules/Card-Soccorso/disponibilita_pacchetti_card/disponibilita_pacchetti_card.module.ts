import { Module } from '@nestjs/common';
import { DisponibilitaPacchettiCardService } from './disponibilita_pacchetti_card.service';
import { DisponibilitaPacchettiCardController } from './disponibilita_pacchetti_card.controller';
import { OrdiniContrConsumoCardsModule } from 'src/modules/ordini/ordini-contr-consumo-cards/ordini-contr-consumo-cards.module';

@Module({
  imports: [OrdiniContrConsumoCardsModule],
  controllers: [DisponibilitaPacchettiCardController],
  providers: [DisponibilitaPacchettiCardService],
  exports: [DisponibilitaPacchettiCardService]
})
export class DisponibilitaPacchettiCardModule { }
