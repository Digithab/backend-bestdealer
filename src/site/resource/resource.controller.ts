import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Query, Res, HttpException, HttpStatus, UploadedFile, UseInterceptors, Request } from '@nestjs/common';
import { ResourceService } from './resource.service';
import { CreateDto, CreateResourceDto } from './dto/create-resource.dto';
import { UpdateResourceDto } from './dto/update-resource.dto';
import { JwtAuthGuard } from 'src/modules/auth/jwt-auth.guard';
import { Response } from 'express';
import { FtpServiceService } from 'src/ftp-service/ftp-service.service';
import { FileInterceptor } from '@nestjs/platform-express';
import { get } from 'http';

@Controller('resource')
@UseGuards(JwtAuthGuard) // Asegúrate de proteger estas rutas
export class ResourceController {
  constructor(
    private readonly resourceService: ResourceService,
    private ftpService: FtpServiceService
  ) { }

  @Get('site/getAgenti')
  getAgenti() {
    return this.resourceService.getAgenti();
  }

  @Get('site/getAgentiDenomizacione')
  getAgentiDenomizacione() {
    return this.resourceService.getAgentiDenomizacione();
  }

  // @Get('site/getDealer/:id')
  // getDealer(@Param('id') id: string) {
  //   return this.resourceService.getDealer(id);
  // }

  @Get('site/getDealer')
  getDealer(
    @Query('agente') agente?: string,
    @Query('denominazione') denominazione?: string,
    @Query('id') id?: string
  ) {
    return this.resourceService.getDealer(agente, denominazione, id);
  }

  @Get('site/get-clienti')
  findByClienti(@Query('search') search?: string, @Query('client_type') client_type?: any) {
    console.log('client_type__ ', client_type)
    return this.resourceService.findByClienti(search, client_type);
  }

  @Get('site/dealer-garanzie/:id')
  GaranzieDealer(@Param('id') id: string) {
    return this.resourceService.GaranzieDealer(+id);
  }

  @Get('site/getVenditore/:id')
  getVenditore(@Param('id') id: string) {
    return this.resourceService.dealersVenditori(id);
  }

  @Get('site/getMarca')
  getMarca() {
    return this.resourceService.getMarca();
  }

  @Get('site/getModelo/:id')
  getModelo(@Param('id') id: string) {
    return this.resourceService.getModelo(id);
  }

  @Get('site/getFornitori')
  getFornitori() {
    return this.resourceService.getFornitori();
  }

  @Get('site/getDealers')
  getDealers() {
    return this.resourceService.getDealers();
  }

  @Get('site/type/:id')
  typeGaranties(@Param('id') id: string) {
    return this.resourceService.typeGaranties(id);
  }

  @Patch('site/type/:id')
  updatePrezzo(@Param('id') id: string, @Body() Dto: any, @Request() req) {
    const email = req.user.email
    const { prezzo_listino } = Dto
    console.log('prezzo: ', prezzo_listino)
    return this.resourceService.updatePrezzo(id, prezzo_listino, email);
  }

  @Get('site/download/:id')
  async download(
    @Param('id') id: string,
    @Res() res: Response
  ) {
    try {
      const fileId = parseInt(id, 10);
      const fileName = `${fileId}.pdf`;
      console.log('fileName___ ', fileName)
      const filePath = `/httpdocs/storage/contratti/${fileName}`;

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

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  uploadFile(
    @UploadedFile() file: {
      fieldname: string;
      originalname: string;
      encoding: string;
      mimetype: string;
      buffer: Buffer;
      size: number;
    },
    @Body() createDto: Omit<CreateDto, 'file'>,
    @Request() req
  ) {
    console.log('req.email___dasd ', req.email)
    const email = req.user.email

    return this.resourceService.uploadFile({
      ...createDto,
      file
    }, email);
  }
}
