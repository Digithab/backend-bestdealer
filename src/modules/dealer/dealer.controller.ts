import { Controller, Get, Post, Body, Patch, Param, Delete, Query, Request, UseGuards, UseInterceptors, UploadedFile, Res, HttpStatus, HttpException } from '@nestjs/common';
import { DealerService } from './dealer.service';
import { CreateDealerDto } from './dto/create-dealer.dto';
import { UpdateDealerDto } from './dto/update-dealer.dto';
import { ApiOperation, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { FileInterceptor } from '@nestjs/platform-express';
import { FtpServiceService } from 'src/ftp-service/ftp-service.service';
import { Response } from 'express';

@Controller('dealer')
@UseGuards(JwtAuthGuard) // Asegúrate de proteger estas rutas
export class DealerController {

  constructor(

    private readonly dealerService: DealerService,
    private ftpService: FtpServiceService

  ) { }

  @Post()
  create(
    @Body() createDealerDto: CreateDealerDto,
    @Request() req
  ) {
    const email = req.email.email
    return this.dealerService.create(createDealerDto, email);
  }

  @Get('allegati/:id')
  findDealerDocuments(
    @Param('id') id: string,
    @Request() req
  ) {
    const email = req.email.email;
    return this.dealerService.findDealerDocuments(id, email)
  }

  @Post('document')
  @UseInterceptors(FileInterceptor('file'))
  uploadDocument(
    @UploadedFile() file: {
      fieldname: string;
      fileType: string;
      originalname: string;
      encoding: string;
      mimetype: string;
      buffer: Buffer;
      size: number;
    },
    @Body() documentDto: any,
    @Request() req
  ) {
    const email = req.email.email;
    return this.dealerService.uploadDocument(
      { ...documentDto, file },
      email)
  }

  @Delete('document/:id')
  deleteDocument(
    @Param('id') id: string,
    @Request() req
  ) {
    const email = req.email.email;
    return this.dealerService.deleteDocument(id, email)
  }

  @Post('venditore')
  createVenditore(
    @Body() data: any,
    @Request() req
  ) {
    const email = req.email.email;
    return this.dealerService.createVenditore(data, email)
  }

  @Get()
  @ApiOperation({ summary: 'Get agenti with optional filters and pagination' })
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
    const { dealer, total } = await this.dealerService.getDealer(search, page, limit, sort, order);

    return {
      data: dealer,
      total: total,
      page: page,
      limit: limit,
      totalPages: Math.ceil(total / limit)
    };
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.dealerService.findOne(+id);
  }

  @Get('venditore/:id')
  findVenditore(@Param('id') id: string | any) {

    return this.dealerService.findVenditore(id)
  }


  @Patch(':id')
  update(@Param('id') id: string, @Body() updateDealerDto: UpdateDealerDto) {
    return this.dealerService.update(+id, updateDealerDto);
  }

  @Patch('venditore/:id')
  updateVenditore(@Param('id') id: string, @Body() data: any) {
    return this.dealerService.updateVenditore(+id, data);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.dealerService.remove(+id);
  }

  @Delete('venditore/:id')
  removeVenditore(@Param('id') id: string) {
    return this.dealerService.removeVenditore(+id);
  }


  @Get('download/allegati/:id')
  async download(
    @Param('id') id: string,
    @Res() res: Response,
    @Request() req
  ) {
    try {
      const email = req.email.email;
      const allegati = await this.dealerService.findDocument(+id, email);
      console.log('allegati: ', allegati);
      const fileExtension = allegati.ext;
      console.log('fileExtension: ', fileExtension);

      // Usa la extensión del evento para construir la ruta
      // Produccion - const filePath = `/httpdocs/storage/guasti/${directory}/${eventId}.${fileExtension}`;
      const filePath = `/httpdocs/storage/prova/${id}.${fileExtension}`;

      const fileBuffer = await this.ftpService.getFile(filePath);

      // Configura el Content-Type según la extensión del archivo
      const contentType = this.getContentType(fileExtension);

      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Disposition', `attachment; filename="${id}.${fileExtension}"`);
      res.end(fileBuffer);
    } catch (error) {
      console.error('Error al descargar el archivo:', error);
      throw new HttpException(
        'Errore durante il download del file',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  // Añade este método para determinar el Content-Type según la extensión
  private getContentType(extension: string): string {
    const mimeTypes = {
      'pdf': 'application/pdf',
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'png': 'image/png',
      'gif': 'image/gif',
      'doc': 'application/msword',
      'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'xls': 'application/vnd.ms-excel',
      'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'ppt': 'application/vnd.ms-powerpoint',
      'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'txt': 'text/plain',
      'csv': 'text/csv',
      'zip': 'application/zip',
      'rar': 'application/x-rar-compressed',
      'mp4': 'video/mp4',
      'mp3': 'audio/mpeg'
    };

    // Normaliza la extensión (quita el punto si existe y convierte a minúsculas)
    const normalizedExtension = extension.toLowerCase().replace(/^\./, '');

    // Devuelve el tipo MIME correspondiente o application/octet-stream si no está en la lista
    return mimeTypes[normalizedExtension] || 'application/octet-stream';
  }
}
