import { Controller, Get, Post, Body, Patch, Param, Delete, Query, UseGuards, Request, Res, HttpException, HttpStatus } from '@nestjs/common';
import { ProformaService } from './proforma.service';
import { CreateProformaDto } from './dto/create-proforma.dto';
import { UpdateProformaDto } from './dto/update-proforma.dto';
import { ApiOperation, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/modules/auth/jwt-auth.guard';
import { FtpServiceService } from 'src/ftp-service/ftp-service.service';
import { Response } from 'express';

@Controller('proforma')
@UseGuards(JwtAuthGuard) // Asegúrate de proteger estas rutas
export class ProformaController {
  constructor(
    private readonly proformaService: ProformaService,
    private ftpService: FtpServiceService
  ) { }

  @Post()
  create(@Body() createProformaDto: CreateProformaDto, @Request() req) {
    console.log(req.email)
    const email = req.email.email
    return this.proformaService.create(createProformaDto, email);
  }

  @Post('gen-pdf')
  async genPdf(@Body() id: any) {
    return this.proformaService.genPdfProforma(id.id)
  }

  @Post('invia-proforma')
  actionInviaProforma(@Body() id: any, @Request() req) {
    const email = req.email.email

    return this.proformaService.actionInviaProforma(id, email)
  }

  @Post('sel-invia-proforma')
  actionNotificaSelezionati(@Body() sel: any, @Request() req) {
    const email = req.email.email

    return this.proformaService.actionNotificaSelezionati(sel, email)
  }

  @Get('/finalizza-proforma/:id')
  actionFinalizzaProforma(@Param() id: any, @Request() req) {
    const email = req.email.email

    return this.proformaService.actionFinalizzaProforma(id, email)
  }

  @Get()
  @ApiOperation({ summary: 'Get garanzie with optional filters and pagination' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'sort', required: false, type: String })
  @ApiQuery({ name: 'order', required: false, enum: ['ASC', 'DESC'] })
  async getAgenti(
    @Query() search: any,
    @Query('page') page: number,
    @Query('limit') limit: number,
    @Query('sort') sort?: string,
    @Query('order') order?: 'ASC' | 'DESC'
  ) {
    const { proforma, total, importo_total, incaso_total, saldo_total } = await this.proformaService.getProforma(search, page, limit, sort, order);

    return {
      data: proforma,
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
    return this.proformaService.findOne(+id);
  }

  @Get('/recalc-totale/:id')
  recalcTotaleProforma(@Param('id') id: string) {
    return this.proformaService.recalcTotaleProforma(+id);
  }

  @Get('/data-to-fattura/:id')
  dataToFattura(@Param('id') id: string) {
    return this.proformaService.dataToFattura(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateProformaDto: any, @Request() req) {
    const email = req.email.email
    return this.proformaService.update(+id, updateProformaDto, email);
  }

  @Delete('update-liberi/:id')
  removeLiberti(@Param('id') id: string, @Request() req) {
    const email = req.email.email
    return this.proformaService.removeLiberti(+id, email);
  }
  @Delete(':id')
  remove(@Param('id') id: string, @Request() req) {
    console.log(req.email)
    const email = req.email.email
    return this.proformaService.remove(+id, email);
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
}
