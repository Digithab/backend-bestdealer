import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { StadisticsService } from './stadistics.service';
import { format } from 'date-fns';
import { DataSource, EntityManager } from 'typeorm';
import { InjectDataSource, InjectEntityManager } from '@nestjs/typeorm';

interface ProformaData {
  tipo_proforma: string;
  venduto: number;
  fatturato: number;
  incasso: number;
}

interface DealerStats {
  proformaData: ProformaData[];
  speso_guasti: number;
  garanzie: number;
  garanzie_scadute: number;
  soccorsi_venduti: number;
  soccorsi_aperti: number;
  auto_sost: number;
}

@Controller('stadistics')
export class StadisticsController {
  constructor(
    private readonly stadisticsService: StadisticsService,

  ) { }

  @Get(':id')
  getTabellaIncidenzeProvider(@Param('id') id: string) {
    return this.stadisticsService.getTabellaIncidenzeProvider(+id);
  }


}
