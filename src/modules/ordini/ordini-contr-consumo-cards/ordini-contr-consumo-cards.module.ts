import { forwardRef, Module } from '@nestjs/common';
import { OrdiniContrConsumoCardsService } from './ordini-contr-consumo-cards.service';
import { OrdiniContrConsumoCardsController } from './ordini-contr-consumo-cards.controller';
import { UsersModule } from 'src/modules/users/users.module';
import { ProformaModule } from 'src/modules/Fatture/proforma/proforma.module';
import { GaranzieModule } from 'src/modules/Guarantees/garanzie/garanzie.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MailModule } from 'src/mail/mail.module';
import { GenPdfModule } from 'src/modules/gen-pdf/gen-pdf.module';
import { OrdiniContrConsumoService } from '../ordini-contr-consumo/ordini-contr-consumo.service';
import { OrdiniContrConsumoModule } from '../ordini-contr-consumo/ordini-contr-consumo.module';

@Module({
  imports: [
    forwardRef(() => ProformaModule),
    TypeOrmModule,
    UsersModule,
    forwardRef(() => MailModule),
    forwardRef(() => GenPdfModule),
  ],
  controllers: [OrdiniContrConsumoCardsController],
  providers: [OrdiniContrConsumoCardsService],
  exports: [OrdiniContrConsumoCardsService]
})
export class OrdiniContrConsumoCardsModule { }
