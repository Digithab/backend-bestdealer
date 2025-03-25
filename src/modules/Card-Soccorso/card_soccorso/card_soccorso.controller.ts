import { Controller, Get, Post, Body, Patch, Param, Delete, Query, ValidationPipe, NotFoundException, Request, UseGuards, Res, HttpException, HttpStatus } from '@nestjs/common';
import { CardSoccorsoService } from './card_soccorso.service';
import { CreateCardSoccorsoDto } from './dto/create-card_soccorso.dto';
import { UpdateCardSoccorsoDto } from './dto/update-card_soccorso.dto';
import { ApiOperation, ApiQuery } from '@nestjs/swagger';
import { Card } from './interface/card.interface';
import { IsInt, IsPositive } from 'class-validator';
import { Transform } from 'class-transformer';
import { JwtAuthGuard } from 'src/modules/auth/jwt-auth.guard';
import { Response } from 'express';
import { FtpServiceService } from 'src/ftp-service/ftp-service.service';

class IdParam {
  @IsInt()
  @IsPositive()
  @Transform(({ value }) => parseInt(value, 10))
  id: number;
}

@Controller('card-soccorso')
@UseGuards(JwtAuthGuard) // Asegúrate de proteger estas rutas
export class CardSoccorsoController {
  constructor(
    private readonly cardSoccorsoService: CardSoccorsoService,
    private ftpService: FtpServiceService
  ) { }

  @Post()
  create(@Body() createCardSoccorsoDto: CreateCardSoccorsoDto, @Request() req
  ) {
    console.log('req.email___dasd ', req.email)
    const email = req.email.email
    return this.cardSoccorsoService.create(createCardSoccorsoDto, email);
  }

  @Get()
  @ApiOperation({ summary: 'Get agenti with optional filters and pagination' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'sort', required: false, type: String })
  @ApiQuery({ name: 'order', required: false, enum: ['ASC', 'DESC'] })
  async getAgenti(
    @Query() search: Card,
    @Query('page') page: number,
    @Query('limit') limit: number,
    @Query('sort') sort?: string,
    @Query('order') order?: 'ASC' | 'DESC'
  ) {
    const { card, total } = await this.cardSoccorsoService.getCardSoccorso(search, page, limit, sort, order);

    return {
      data: card,
      total: total,
      page: page,
      limit: limit,
      totalPages: Math.ceil(total / limit)
    };
  }

  @Get('/gen-pdf-soccorso/:id')
  genPdfCardSoccorso(
    @Param('id') id: number,
  ) {
    console.log('genPdfSoccorso___ ', id)
    // console.log('req.email___ ', req.email)
    // const email = req.email.email
    return this.cardSoccorsoService.genPdfCardSoccorso(id);
  }

  @Get(':id')
  async findOne(@Param(ValidationPipe) { id }: IdParam) {
    const card = await this.cardSoccorsoService.findOne(+id);

    if (!card) {
      throw new NotFoundException(`Cliente with ID ${id} not found`);
    }

    return card
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateCardSoccorsoDto: UpdateCardSoccorsoDto, @Request() req
  ) {
    console.log('req.email___dasd ', req.email)
    const email = req.email.email
    return this.cardSoccorsoService.update(+id, updateCardSoccorsoDto, email);
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    const is_delete = await this.cardSoccorsoService.remove(+id);

    if (!is_delete) {
      throw new NotFoundException(`Clienti with ID ${id} not found`);
    }

    return is_delete
  }

  @Get('donwload/:id')
  async download(
    @Param('id') id: string,
    @Res() res: Response
  ) {
    try {
      const fileId = parseInt(id, 10) + 3000;
      const fileName = `CS${fileId}.pdf`;
      console.log('fileName___ ', fileName)
      const filePath = `/httpdocs/storage/card_soccorso/${fileName}`;

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
