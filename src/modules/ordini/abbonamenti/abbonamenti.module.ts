import { forwardRef, Module } from '@nestjs/common';
import { AbbonamentiService } from './abbonamenti.service';
import { AbbonamentiController } from './abbonamenti.controller';
import { UsersModule } from 'src/modules/users/users.module';
import { ProformaService } from 'src/modules/Fatture/proforma/proforma.service';
import { OrdiniContrConsumoCardsModule } from '../ordini-contr-consumo-cards/ordini-contr-consumo-cards.module';
import { ProformaModule } from 'src/modules/Fatture/proforma/proforma.module';
import { MailModule } from 'src/mail/mail.module';
import { MailService } from 'src/mail/mail.service';

@Module({
  imports: [UsersModule, forwardRef(() => ProformaModule), OrdiniContrConsumoCardsModule, forwardRef(() => MailModule)],
  controllers: [AbbonamentiController],
  providers: [AbbonamentiService],
  exports: [AbbonamentiService]
})
export class AbbonamentiModule { }
