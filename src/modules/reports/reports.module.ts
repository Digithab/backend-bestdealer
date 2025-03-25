import { forwardRef, Module } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { ReportsController } from './reports.controller';

import { OrdiniContrConsumoCardsModule } from '../ordini/ordini-contr-consumo-cards/ordini-contr-consumo-cards.module';

@Module({
  controllers: [ReportsController],
  providers: [ReportsService],
  exports: [ReportsService]
})
export class ReportsModule { }
