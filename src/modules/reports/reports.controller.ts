import { Controller, Get, Param, Query, Res } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { Response } from 'express';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('Reports')
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) { }

  @Get('gen/:id/:mese/:anno')
  async agentiReport(

    @Param('id') id: number,
    @Param('mese') mese: number,
    @Param('anno') anno: number,
    @Res() res: Response
  ) {
    return this.reportsService.agentiReport(id, mese, anno, res);
  }


  @Get('search')
  async getAllDisponibilitaSearch(
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
    @Query('denominazione') denominazione?: string,
    @Query('sigla') sigla?: string,
    @Query('anno') anno?: string,
    @Query('dealer') dealer?: string
  ) {
    return await this.reportsService.getAllReport(
      page,
      limit,
      denominazione,
      sigla,
      anno,
      dealer
    );
  }

  @Get('agent/:id')
  async getAgentCommissions(
    @Param('id') agentId: number,
    @Query('month') month: string,
    @Query('year') year: string
  ) {
    return this.reportsService.calculateAgentCommissions(agentId, month, year);
  }

  @Get('agent/:id/excel')
  async downloadExcel(
    @Param('id') agentId: number,
    @Query('month') month: string,
    @Query('year') year: string,
    @Res() res: Response
  ) {
    const data = await this.reportsService.calculateAgentCommissions(agentId, month, year);
    console.log('data___ ', data)
    return this.reportsService.generateExcel(data, res);
  }
}
