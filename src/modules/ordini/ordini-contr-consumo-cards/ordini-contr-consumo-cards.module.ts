import { forwardRef, Module } from '@nestjs/common';
import { OrdiniContrConsumoCardsService } from './ordini-contr-consumo-cards.service';
import { OrdiniContrConsumoCardsController } from './ordini-contr-consumo-cards.controller';
import { UsersModule } from 'src/modules/users/users.module';
import { ProformaModule } from 'src/modules/Fatture/proforma/proforma.module';
import { ProformaService } from 'src/modules/Fatture/proforma/proforma.service';
import { GaranzieModule } from 'src/modules/Guarantees/garanzie/garanzie.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MailModule } from 'src/mail/mail.module';
import { MailService } from 'src/mail/mail.service';
import { GenPdfModule } from 'src/modules/gen-pdf/gen-pdf.module';

@Module({
  imports: [
    TypeOrmModule,
    UsersModule,
    forwardRef(() => ProformaModule),
    forwardRef(() => MailModule),
    forwardRef(() => GenPdfModule)
  ],
  controllers: [OrdiniContrConsumoCardsController],
  providers: [OrdiniContrConsumoCardsService],
  exports: [OrdiniContrConsumoCardsService]
})
export class OrdiniContrConsumoCardsModule { }
