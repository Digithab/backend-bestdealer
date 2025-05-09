import { Controller, Get, Post, Body, Patch, Param, Delete, Query, Request, UseGuards } from '@nestjs/common';
import { OrdiniPachettiService } from './ordini_pachetti.service';
import { CreateOrdiniPachettiDto } from './dto/create-ordini_pachetti.dto';
import { UpdateOrdiniPachettiDto } from './dto/update-ordini_pachetti.dto';
import { ApiOperation, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/modules/auth/jwt-auth.guard';
import { RolesGuard } from 'src/modules/auth/roles.guard';
import { Roles } from 'src/modules/auth/roles.decorator';

@Controller('ordini-pachetti')
@UseGuards(JwtAuthGuard, RolesGuard) // Asegúrate de proteger estas rutas
export class OrdiniPachettiController {
  constructor(private readonly ordiniPachettiService: OrdiniPachettiService) { }

  @Post()
  @Roles('admin', 'Super Admin')
  create(@Body() createOrdiniPachettiDto: any) {
  
    return this.ordiniPachettiService.create(createOrdiniPachettiDto);
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
    const { ordini, total } = await this.ordiniPachettiService.getOrdini(search, page, limit, sort, order);

    return {
      data: ordini,
      total: total,
      page: page,
      limit: limit,
      totalPages: Math.ceil(total / limit)
    };
  }

  @Get(':id')
  @Roles('admin', 'Super Admin')
  findOne(@Param('id') id: string) {
    return this.ordiniPachettiService.findOne(+id);
  }

  @Get('tipi-garanzie/:dealer')
  tipiGaranziePerdealer(@Param('dealer') dealer: string) {
    return this.ordiniPachettiService.tipiGaranziePerdealer(+dealer)
  }

  @Get('tipi-garanzie-to/:ordine/:dealer')
  tipiGaranzieToPerdealer(@Param('ordine') ordine: string, @Param('dealer') dealer: string) {
    return this.ordiniPachettiService.tipiGaranzieToPerdealer(+ordine, +dealer)
  }

  @Patch(':id')
  @Roles('admin', 'Super Admin')
  update(@Param('id') id: string, @Body() updateOrdiniPachettiDto: any) {    
    return this.ordiniPachettiService.update(+id, updateOrdiniPachettiDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.ordiniPachettiService.remove(+id);
  }
}
