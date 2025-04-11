import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { typeOrmConfig } from './config/database.config';
import { AgentiModule } from './modules/agenti/agenti.module';
import { ComuniModule } from './modules/comuni/comuni.module';
import { ReportsModule } from './modules/reports/reports.module';
import { ClientiModule } from './modules/clienti/clienti.module';
import { CentriConvenzionatiModule } from './modules/centri_convenzionati/centri_convenzionati.module';
import { FornitoriModule } from './modules/fornitori/fornitori.module';
// import { SoccorsiStradaliModule } from './modules/guarantees/soccorsi-stradali/soccorsi-stradali.module';
// import { CondizioniGeneraliModule } from './modules/guarantees/condizioni-generali/condizioni-generali.module';
import { FtpServiceModule } from './ftp-service/ftp-service.module';
import { GaranzieModule } from './modules/Guarantees/garanzie/garanzie.module';
import { ResourceModule } from './site/resource/resource.module';
import { DisponibilitaPacchettiModule } from './modules/Guarantees/disponibilita_pacchetti/disponibilita_pacchetti.module';
import { GuastiModule } from './modules/Guarantees/guasti/guasti.module';
import { StadisticsModule } from './site/stadistics/stadistics.module';
import { DealerModule } from './modules/dealer/dealer.module';
import { SoccorsiStradaliModule } from './modules/Guarantees/soccorsi-stradali/soccorsi-stradali.module';
import { CardSoccorsoModule } from './modules/Card-Soccorso/card_soccorso/card_soccorso.module';
import { OrdiniContrConsumoCardsModule } from './modules/ordini/ordini-contr-consumo-cards/ordini-contr-consumo-cards.module';
import { DisponibilitaPacchettiCardModule } from './modules/Card-Soccorso/disponibilita_pacchetti_card/disponibilita_pacchetti_card.module';
import { AbbonamentiModule } from './modules/ordini/abbonamenti/abbonamenti.module';
import { ProformaModule } from './modules/Fatture/proforma/proforma.module';
import { OrdiniPachettiModule } from './modules/ordini/ordini_pachetti/ordini_pachetti.module';
import { LogModule } from './modules/operation/log/log.module';
import { OrdiniContrConsumoModule } from './modules/ordini/ordini-contr-consumo/ordini-contr-consumo.module';
import { OrdiniPachettiCardsModule } from './modules/ordini/ordini_pachetti_cards/ordini_pachetti_cards.module';
import { FattureModule } from './modules/Fatture/faturre/fatture.module';
import { GenPdfModule } from './modules/gen-pdf/gen-pdf.module';
import { RoleModule } from './modules/role/role.module';



@Module({
  imports: [
    RoleModule,
    AuthModule,
    UsersModule,
    TypeOrmModule.forRoot(typeOrmConfig),
    DealerModule,
    ComuniModule,
    AgentiModule,
    ReportsModule,
    ClientiModule,
    CentriConvenzionatiModule,
    FornitoriModule,
    GaranzieModule,
    DisponibilitaPacchettiModule,
    GuastiModule,
    SoccorsiStradaliModule,
    // CondizioniGeneraliModule,
    FtpServiceModule,
    ResourceModule,
    StadisticsModule,
    CardSoccorsoModule,
    OrdiniContrConsumoCardsModule,
    DisponibilitaPacchettiCardModule,
    AbbonamentiModule,
    ProformaModule,
    OrdiniPachettiModule,
    LogModule,
    OrdiniContrConsumoModule,
    OrdiniPachettiCardsModule,
    FattureModule,
    GenPdfModule
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule { }
