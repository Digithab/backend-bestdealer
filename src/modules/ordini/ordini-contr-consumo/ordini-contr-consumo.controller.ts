import { Controller, Get, Post, Body, Patch, Param, Delete, Request, Query, UseGuards } from '@nestjs/common';
import { OrdiniContrConsumoService } from './ordini-contr-consumo.service';
import { CreateOrdiniContrConsumoDto } from './dto/create-ordini-contr-consumo.dto';
import { UpdateOrdiniContrConsumoDto } from './dto/update-ordini-contr-consumo.dto';
import { ApiOperation, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/modules/auth/jwt-auth.guard';

@Controller('ordini-contr-consumo')
@UseGuards(JwtAuthGuard) // Asegúrate de proteger estas rutas
export class OrdiniContrConsumoController {
  constructor(private readonly ordiniContrConsumoService: OrdiniContrConsumoService) { }

  @Post()
  create(@Body() createOrdiniContrConsumoDto: any, @Request() req) {
    const email = req.email.email
    return this.ordiniContrConsumoService.create(createOrdiniContrConsumoDto, email);
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
    const { contr, total } = await this.ordiniContrConsumoService.getContrConsumo(search, page, limit, sort, order);

    return {
      data: contr,
      total: total,
      page: page,
      limit: limit,
      totalPages: Math.ceil(total / limit)
    };
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.ordiniContrConsumoService.findOne(+id);
  }

  @Get('/garanzia/:dealer/:contratto')
  prezzoGaranziaConsumo(@Param('dealer') dealer: string, @Param('contratto') contratto: string) {
    return this.ordiniContrConsumoService.prezzoGaranziaConsumo(dealer, contratto)
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateOrdiniContrConsumoDto: UpdateOrdiniContrConsumoDto, @Request() req) {
    const email = req.email.email
    return this.ordiniContrConsumoService.update(+id, updateOrdiniContrConsumoDto, email);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.ordiniContrConsumoService.remove(+id);
  }
}
