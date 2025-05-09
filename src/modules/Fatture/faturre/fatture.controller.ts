import { Controller, Get, Post, Body, Patch, Param, Delete, Query, UseGuards, Request, Res, HttpException, HttpStatus } from '@nestjs/common';
import { CreateFaturreDto } from './dto/create-faturre.dto';
import { UpdateFaturreDto } from './dto/update-faturre.dto';
import { ApiOperation, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/modules/auth/jwt-auth.guard';
import { FattureService } from './fatture.service';
import { FtpServiceService } from 'src/ftp-service/ftp-service.service';
import { Response } from 'express';
import { RolesGuard } from 'src/modules/auth/roles.guard';
import { Roles } from 'src/modules/auth/roles.decorator';

@Controller('fatture')
@UseGuards(JwtAuthGuard, RolesGuard) // Asegúrate de proteger estas rutas
export class FattureController {
  constructor(
    private readonly fattureService: FattureService,
    private ftpService: FtpServiceService
  ) { }

  @Post()
  @Roles('admin', 'Super Admin')
  create(@Body() createFaturreDto: any) {

    return this.fattureService.create(createFaturreDto);
  }

  @Post('nota-credito')
  @Roles('admin', 'Super Admin')
  notaCredio(@Body() data: any) {
    return this.fattureService.actionNotaCredito(data);
  }

  @Get()
  @ApiOperation({ summary: 'Get garanzie with optional filters and pagination' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'sort', required: false, type: String })
  @ApiQuery({ name: 'order', required: false, enum: ['ASC', 'DESC'] })
  async getfatture(
    @Query() search: any,
    @Query('page') page: number,
    @Query('limit') limit: number,
    @Query('sort') sort?: string,
    @Query('order') order?: 'ASC' | 'DESC'
  ) {
    const { fatture, total, importo_total, incaso_total, saldo_total } = await this.fattureService.getfatture(search, page, limit, sort, order);

    return {
      data: fatture,
      total: total,
      importo_total: importo_total,
      incaso_total: incaso_total,
      saldo_total: saldo_total,
      page: page,
      limit: limit,
      totalPages: Math.ceil(total / limit)
    };
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.fattureService.findOne(+id);
  }

  @Get('fatture-emesse/:id')
  getFattureEmesse(@Param('id') id: string) {
    return this.fattureService.getFattureEmesse(id)
  }

  @Get('/gen-docs-fatura/:id/:tipo')
  genPdfCardSoccorso(
    @Param('id') id: number,
    @Param('tipo') tipo: boolean,
  ) {
    console.log('genPdfSoccorso___ ', id)
    console.log('tipo___ ', tipo)
    return this.fattureService.genDocsFattura(id, tipo);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateFaturreDto: UpdateFaturreDto) {
    return this.fattureService.update(+id, updateFaturreDto);
  }

  @Delete(':id')
  @Roles('admin', 'Super Admin')
  remove(@Param('id') id: string) {
    return this.fattureService.remove(+id);
  }

  @Post('invia-fattura')
  @Roles('admin', 'Super Admin')
  actionInviaFattura(@Body() id: any) {

    return this.fattureService.actionInviaFattura(id.id)
  }

  @Get('download/:id')
  async download(
    @Param('id') id: string,
    @Res() res: Response
  ) {
    try {
      const fileId = Number(id);
      const fileName = `${fileId}.pdf`;
      console.log('fileName___ ', fileName)
      const filePath = `/httpdocs/storage/prova/${fileName}`;

      console.log('filePathfilePath__ ', filePath)

      const fileBuffer = await this.ftpService.getFile(filePath);
      console.log('fileBuffer____', fileBuffer)
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'inline');
      res.end(fileBuffer);

    } catch (error) {
      throw new HttpException(
        'Errore durante il download del file',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Get('/data-to-nota/:id')
  dataToNota(@Param('id') id: string) {
    return this.fattureService.dataToNota(+id);
  }
}
