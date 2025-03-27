import { Controller, Get, Post, Body, Patch, Param, Delete, Query, Request, UseGuards, HttpException, HttpStatus, Res } from '@nestjs/common';
import { GaranzieService } from './garanzie.service';
import { ApiOperation, ApiQuery } from '@nestjs/swagger';
import { getGaranzie } from './interface/garanzie.interface';
import { CreateGarantiaDto } from './dto/create-garantia.dto';
import { JwtAuthGuard } from 'src/modules/auth/jwt-auth.guard';
import { SaveCommentoDto } from 'src/interfaces/interfaces';
import { FtpServiceService } from 'src/ftp-service/ftp-service.service';
import { Response } from 'express';


@Controller('guarantees/garanzie')
@UseGuards(JwtAuthGuard) // Asegúrate de proteger estas rutas
export class GaranzieController {
  constructor(
    private readonly garanzieService: GaranzieService,
    private ftpService: FtpServiceService
  ) { }

  @Post('/newComment')
  saveComment(
    @Body() commentDto: SaveCommentoDto,
    @Request() req
  ) {
    const email = req.email.email
    console.log('commentDto___ ', commentDto)
    return this.garanzieService.newComment(commentDto, email);
  }

  @Post(':extend')
  create(
    @Body() createGarantiaDto: CreateGarantiaDto,
    @Request() req,
    @Param('extend') extend: string
  ) {
    console.log('req.email___dasd ', req.email)
    const email = req.email.email

    return this.garanzieService.create(
      createGarantiaDto,
      email,
      extend
    );
  }

  @Get()
  @ApiOperation({ summary: 'Get garanzie with optional filters and pagination' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'sort', required: false, type: String })
  @ApiQuery({ name: 'order', required: false, enum: ['ASC', 'DESC'] })
  async getAgenti(
    @Query() search: getGaranzie,
    @Query('page') page: number,
    @Query('limit') limit: number,
    @Query('sort') sort?: string,
    @Query('order') order?: 'ASC' | 'DESC'
  ) {
    const { garanzie, total } = await this.garanzieService.getGaranzie(search, page, limit, sort, order);

    return {
      data: garanzie,
      total: total,
      page: page,
      limit: limit,
      totalPages: Math.ceil(total / limit)
    };
  }



  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.garanzieService.findOne(+id);
  }

  @Get('getComment/:id')
  getComment(
    @Param('id') id: number,
    @Request() req
  ) {
    console.log('req.email___ ', req.email)
    const email = req.email.email
    return this.garanzieService.getComment(id, email);
  }

  @Get('/gen-pdf-garanzia/:id')
  genPdfGaranzia(
    @Param('id') id: number,
  ) {
    console.log('genPdfGaranzia___ ', id)
    // console.log('req.email___ ', req.email)
    // const email = req.email.email
    return this.garanzieService.genPdfGaranzia(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateGaranzieDto: any, @Request() req) {
    const email = req.email.email
    return this.garanzieService.update(
      +id,
      updateGaranzieDto,
      email

    );
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.garanzieService.remove(+id);
  }

  @Get('download/:id')
  async download(
    @Param('id') id: string,
    @Res() res: Response
  ) {
    try {
      const fileId = parseInt(id, 10) + 15000;
      const fileName = `GR${fileId}.pdf`;
      console.log('fileName___ ', fileName)
      const filePath = `/httpdocs/storage/garanzie/${fileName}`;

      console.log('filePathfilePath__ ', filePath)

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
