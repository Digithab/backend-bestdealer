import { Controller, Get, Param, Res } from '@nestjs/common';
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


}
