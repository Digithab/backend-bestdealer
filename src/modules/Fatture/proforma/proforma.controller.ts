import { Controller, Get, Post, Body, Patch, Param, Delete, Query, UseGuards, Request, Res, HttpException, HttpStatus } from '@nestjs/common';
import { ProformaService } from './proforma.service';
import { CreateProformaDto } from './dto/create-proforma.dto';
import { UpdateProformaDto } from './dto/update-proforma.dto';
import { ApiOperation, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/modules/auth/jwt-auth.guard';
import { FtpServiceService } from 'src/ftp-service/ftp-service.service';
import { Response } from 'express';
import { RolesGuard } from 'src/modules/auth/roles.guard';
import { Roles } from 'src/modules/auth/roles.decorator';

@Controller('proforma')
@UseGuards(JwtAuthGuard, RolesGuard) // Asegúrate de proteger estas rutas
export class ProformaController {
  constructor(
    private readonly proformaService: ProformaService,
    private ftpService: FtpServiceService
  ) { }

  @Post()
  @Roles('admin', 'Super Admin')
  create(@Body() createProformaDto: CreateProformaDto) {

    return this.proformaService.create(createProformaDto);
  }

  @Post('gen-pdf')

  async genPdf(@Body() id: any) {
    return this.proformaService.genPdfProforma(id.id)
  }

  @Post('invia-proforma/:id')
  @Roles('admin', 'Super Admin')
  actionInviaProforma(@Param() id: any) {

    console.log(id)
    return this.proformaService.actionInviaProforma(id)
  }

  @Post('sel-invia-proforma')
  @Roles('admin', 'Super Admin')
  actionNotificaSelezionati(@Body() sel: any) {


    return this.proformaService.actionNotificaSelezionati(sel)
  }

  @Post('/finalizza-proforma/:id')
  @Roles('admin', 'Super Admin')
  actionFinalizzaProforma(@Param('id') id: string) {
    console.log('actionFinalizzaProforma___ ', id)
    return this.proformaService.actionFinalizzaProforma(+id)
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
  @Roles('admin', 'Super Admin')
  recalcTotaleProforma(@Param('id') id: string) {
    return this.proformaService.recalcTotaleProforma(+id);
  }

  @Get('/data-to-fattura/:id')
  @Roles('admin', 'Super Admin')
  dataToFattura(@Param('id') id: string) {
    return this.proformaService.dataToFattura(+id);
  }

  @Patch(':id')
  @Roles('admin', 'Super Admin')
  update(@Param('id') id: string, @Body() updateProformaDto: any) {

    return this.proformaService.update(+id, updateProformaDto);
  }

  @Delete('update-liberi/:id')
  removeLiberti(@Param('id') id: string) {

    return this.proformaService.removeLiberti(+id);
  }
  @Delete(':id')
  remove(@Param('id') id: string) {

    return this.proformaService.remove(+id);
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
      const filePath = `/httpdocs/storage/prova/proforma/${fileName}`;

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
