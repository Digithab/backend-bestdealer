import { Controller, Get, Post, Body, Patch, Param, Delete, Query, UseGuards, Request } from '@nestjs/common';
import { OrdiniContrConsumoCardsService } from './ordini-contr-consumo-cards.service';
import { CreateOrdiniContrConsumoCardDto } from './dto/create-ordini-contr-consumo-card.dto';
import { UpdateOrdiniContrConsumoCardDto } from './dto/update-ordini-contr-consumo-card.dto';
import { ApiOperation, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/modules/auth/jwt-auth.guard';

@Controller('ordini-contr-consumo-cards')
@UseGuards(JwtAuthGuard) // Asegúrate de proteger estas rutas
export class OrdiniContrConsumoCardsController {
  constructor(private readonly ordiniContrConsumoCardsService: OrdiniContrConsumoCardsService) { }

  @Post()
  create(@Body() createOrdiniContrConsumoCardDto: CreateOrdiniContrConsumoCardDto, @Request() req) {
    console.log(req.email)
    const email = req.email.email
    return this.ordiniContrConsumoCardsService.create(createOrdiniContrConsumoCardDto, email);
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
    const { ordini, total } = await this.ordiniContrConsumoCardsService.getOrdini(search, page, limit, sort, order);

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
    return this.ordiniContrConsumoCardsService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateOrdiniContrConsumoCardDto: any, @Request() req) {
    console.log(req.email)
    const email = req.email.email
    return this.ordiniContrConsumoCardsService.update(+id, updateOrdiniContrConsumoCardDto, email);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.ordiniContrConsumoCardsService.remove(+id);
  }
}
