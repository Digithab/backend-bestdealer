import { Controller, Get, Post, Body, Patch, Param, Delete, Query } from '@nestjs/common';
import { StadisticsService, TimePeriod } from './stadistics.service';

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

  @Get('/stats/all')
  async getStats(@Query('period') period: TimePeriod = TimePeriod.TODAY) {
    console.log('period___ ', period)
    const stats = await this.stadisticsService.getGarantiaStats(period);
    const totalSales = await this.stadisticsService.getTotalSales(period);


    return {
      period,
      totalSales,
      stats
    };
  }

  @Get('summary')
  async getSummary() {
    // Obtener estadísticas para todos los periodos
    const today = await this.stadisticsService.getGarantiaStats(TimePeriod.TODAY);
    const week = await this.stadisticsService.getGarantiaStats(TimePeriod.WEEK);
    const month = await this.stadisticsService.getGarantiaStats(TimePeriod.MONTH);
    const year = await this.stadisticsService.getGarantiaStats(TimePeriod.YEAR);

    // Calcular totales de ventas para cada periodo
    const todaySales = await this.stadisticsService.getTotalSales(TimePeriod.TODAY);
    const weekSales = await this.stadisticsService.getTotalSales(TimePeriod.WEEK);
    const monthSales = await this.stadisticsService.getTotalSales(TimePeriod.MONTH);
    const yearSales = await this.stadisticsService.getTotalSales(TimePeriod.YEAR);

    return {
      sales: {
        today: todaySales,
        week: weekSales,
        month: monthSales,
        year: yearSales
      },
      stats: {
        today,
        week,
        month,
        year
      }
    };
  }


}
