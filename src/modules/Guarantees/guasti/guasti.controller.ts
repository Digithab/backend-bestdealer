import { Controller, Get, Post, Body, Patch, Param, Delete, Query, Request, UseGuards, UseInterceptors, UploadedFile, Res, HttpException, HttpStatus } from '@nestjs/common';
import { GuastiService } from './guasti.service';
import { CreateGuastiDto } from './dto/create-guasti.dto';
import { UpdateGuastiDto } from './dto/update-guasti.dto';
import { ApiOperation, ApiQuery } from '@nestjs/swagger';
import { Response } from 'express';
import { JwtAuthGuard } from 'src/modules/auth/jwt-auth.guard';
import { CreateRicambiDto } from './dto/create-ricambi.dto';
import { CreateEventDto } from './dto/create-event.dto';
import { FileInterceptor } from '@nestjs/platform-express';
import { Express } from 'express';
import { FtpServiceService } from 'src/ftp-service/ftp-service.service';
import { Roles } from 'src/modules/auth/roles.decorator';
import { RolesGuard } from 'src/modules/auth/roles.guard';

@Controller('guarantees/guasti')
@UseGuards(JwtAuthGuard, RolesGuard) // Asegúrate de proteger estas rutas
export class GuastiController {
  constructor(
    private readonly guastiService: GuastiService,
    private ftpService: FtpServiceService
  ) { }

  @Post()
  @Roles('admin', 'Super Admin')
  @UseInterceptors(FileInterceptor('file'))
  create(
    @UploadedFile() file: {
      fieldname: string;
      fileType: string;
      originalname: string;
      encoding: string;
      mimetype: string;
      buffer: Buffer;
      size: number;
    },
    @Body() createGarantiaDto: Omit<CreateGuastiDto, 'file'>,
  ) {

    return this.guastiService.create({
      ...createGarantiaDto,
      file
    });
  }

  @Post('ricambi')
  @Roles('admin', 'Super Admin')
  addRicambio(
    @Body() createRicambiDto: CreateRicambiDto,
  ) {


    return this.guastiService.addRicambio(
      createRicambiDto
    );
  }

  @Post('event')
  @Roles('admin', 'Super Admin')
  @UseInterceptors(FileInterceptor('file'))
  addEvent(
    @UploadedFile() file: {
      fieldname: string;
      originalname: string;
      encoding: string;
      mimetype: string;
      buffer: Buffer;
      size: number;
    },
    @Body() createEventDto: Omit<CreateEventDto, 'file'>,
  ) {

    return this.guastiService.addEvent({
      ...createEventDto,
      file
    });
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
    const { guasti, total, total_preventivo_riparazione, total_costo_azienda, total_costo_dealer } = await this.guastiService.getAllGuasti(search, page, limit, sort, order);

    return {
      data: guasti,
      total: total,
      total_preventivo_riparazione: total_preventivo_riparazione,
      total_costo_azienda: total_costo_azienda,
      total_costo_dealer: total_costo_dealer,
      page: page,
      limit: limit,
      totalPages: Math.ceil(total / limit)
    };
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.guastiService.findOne(+id);
  }

  @Get('ricambi/:id')
  getRicambi(@Param('id') id: string) {
    return this.guastiService.getRicambi(+id);
  }

  @Get('event/:id')
  getEvent(@Param('id') id: string) {
    return this.guastiService.getEvent(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateGuastiDto: UpdateGuastiDto) {
    return this.guastiService.update(+id, updateGuastiDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.guastiService.remove(+id);
  }

  @Delete('ricambi/:id')
  removeRicambi(@Param('id') id: string) {
    return this.guastiService.deleteRicambio(+id);
  }

  @Delete('event/:id')
  removeEvent(@Param('id') id: string) {
    return this.guastiService.deleteEvent(+id);
  }

  @Get('download/event/:id/:eventId')
  async download(
    @Param('id') id: string,
    @Param('eventId') eventId: string,
    @Res() res: Response
  ) {
    try {
      const event = await this.guastiService.getOneEvent(+eventId)

      const directory = `PRT${id.toString().padStart(5, '0')}`;

      const fileExtension = event.estensione_file;
      console.log('fileExtension: ', fileExtension)
      // Produccion - const filePath = `/httpdocs/storage/guasti/${directory}/${eventId}.${fileExtension}`;

      const filePath = `/httpdocs/storage/prova/${eventId}.pdf`;



      const fileBuffer = await this.ftpService.getFile(filePath);
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
