import { Controller, Get, Post, Body, Patch, Param, Delete, Query } from '@nestjs/common';
import { DisponibilitaPacchettiCardService } from './disponibilita_pacchetti_card.service';
import { CreateDisponibilitaPacchettiCardDto } from './dto/create-disponibilita_pacchetti_card.dto';
import { UpdateDisponibilitaPacchettiCardDto } from './dto/update-disponibilita_pacchetti_card.dto';
import { ApiOperation, ApiQuery } from '@nestjs/swagger';

@Controller('disponibilita-pacchetti-card')
export class DisponibilitaPacchettiCardController {
  constructor(private readonly disponibilitaPacchettiCardService: DisponibilitaPacchettiCardService) { }

  @Post()
  create(@Body() createDisponibilitaPacchettiCardDto: CreateDisponibilitaPacchettiCardDto) {
    return this.disponibilitaPacchettiCardService.create(createDisponibilitaPacchettiCardDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get agenti with optional filters and pagination' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'sort', required: false, type: String })
  @ApiQuery({ name: 'order', required: false, enum: ['ASC', 'DESC'] })
  async getAllDisponibiitaCard(
    @Query() search: CardSearch,
    @Query('page') page: number,
    @Query('limit') limit: number,
    @Query('sort') sort?: string,
    @Query('order') order?: 'ASC' | 'DESC'
  ) {
    const { card, total } = await this.disponibilitaPacchettiCardService.getAllDisponibiitaCard(search, page, limit, sort, order);

    return {
      data: card,
      total: total,
      page: page,
      limit: limit,
      totalPages: Math.ceil(total / limit)
    };
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.disponibilitaPacchettiCardService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateDisponibilitaPacchettiCardDto: UpdateDisponibilitaPacchettiCardDto) {
    return this.disponibilitaPacchettiCardService.update(+id, updateDisponibilitaPacchettiCardDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.disponibilitaPacchettiCardService.remove(+id);
  }
}
