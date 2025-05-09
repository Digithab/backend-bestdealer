import { Controller, Get, Post, Body, Patch, Param, Delete, Query, UseGuards, Request } from '@nestjs/common';
import { OrdiniPachettiCardsService } from './ordini_pachetti_cards.service';
import { CreateOrdiniPachettiCardDto } from './dto/create-ordini_pachetti_card.dto';
import { UpdateOrdiniPachettiCardDto } from './dto/update-ordini_pachetti_card.dto';
import { ApiOperation, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/modules/auth/jwt-auth.guard';
import { RolesGuard } from 'src/modules/auth/roles.guard';
import { Roles } from 'src/modules/auth/roles.decorator';

@Controller('ordini-pachetti-cards')
@UseGuards(JwtAuthGuard, RolesGuard) 
export class OrdiniPachettiCardsController {
  constructor(private readonly ordiniPachettiCardsService: OrdiniPachettiCardsService) { }

  @Post()
  @Roles('admin', 'Super Admin')
  create(@Body() createOrdiniPachettiCardDto: CreateOrdiniPachettiCardDto) {    
    return this.ordiniPachettiCardsService.create(createOrdiniPachettiCardDto);
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
    const { ordini, total } = await this.ordiniPachettiCardsService.getOrdini(search, page, limit, sort, order);

    return {
      data: ordini,
      total: total,
      page: page,
      limit: limit,
      totalPages: Math.ceil(total / limit)
    };
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.ordiniPachettiCardsService.findOne(+id);
  }

  @Get('/ordini-card/:id')
  ordiniCards(@Param('id') id: string) {
    return this.ordiniPachettiCardsService.ordiniCards(+id);
  }

  @Patch(':id')
  @Roles('admin', 'Super Admin')
  update(@Param('id') id: string, @Body() updateOrdiniPachettiCardDto: UpdateOrdiniPachettiCardDto) {    
    return this.ordiniPachettiCardsService.update(+id, updateOrdiniPachettiCardDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.ordiniPachettiCardsService.remove(+id);
  }
}
