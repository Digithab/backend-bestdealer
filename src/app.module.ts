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



@Module({
  imports: [
    AuthModule,
    UsersModule,
    TypeOrmModule.forRoot(typeOrmConfig),
    ComuniModule,
    AgentiModule,
    ReportsModule,
    ClientiModule,
    CentriConvenzionatiModule,
    FornitoriModule
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule { }
