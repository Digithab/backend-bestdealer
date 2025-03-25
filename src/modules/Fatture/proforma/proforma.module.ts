import { Module, forwardRef } from '@nestjs/common';
import { ProformaService } from './proforma.service';
import { ProformaController } from './proforma.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrdiniContrConsumoCardsModule } from 'src/modules/ordini/ordini-contr-consumo-cards/ordini-contr-consumo-cards.module';
import { OrdiniContrConsumoCardsService } from 'src/modules/ordini/ordini-contr-consumo-cards/ordini-contr-consumo-cards.service';
import { OrdiniContrConsumoService } from '../../ordini/ordini-contr-consumo/ordini-contr-consumo.service';
import { UsersModule } from 'src/modules/users/users.module';
import { MailService } from 'src/mail/mail.service';
import { MailModule } from 'src/mail/mail.module';
import { AbbonamentiModule } from 'src/modules/ordini/abbonamenti/abbonamenti.module';
import { GenPdfModule } from 'src/modules/gen-pdf/gen-pdf.module';
import { OrdiniContrConsumoModule } from 'src/modules/ordini/ordini-contr-consumo/ordini-contr-consumo.module';
import { GenPdfService } from 'src/modules/gen-pdf/gen-pdf.service';
import { FtpServiceModule } from 'src/ftp-service/ftp-service.module';

@Module({
  imports: [
    TypeOrmModule,
    forwardRef(() => OrdiniContrConsumoCardsModule),
    forwardRef(() => OrdiniContrConsumoModule),
    UsersModule,
    forwardRef(() => MailModule),
    GenPdfModule,
    FtpServiceModule
  ],
  controllers: [ProformaController],
  providers: [ProformaService, MailService, OrdiniContrConsumoService, GenPdfService],
  exports: [ProformaService]
})
export class ProformaModule { }
