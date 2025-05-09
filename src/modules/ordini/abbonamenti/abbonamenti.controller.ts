import { Controller, Get, Post, Body, Patch, Param, Delete, Request, UseGuards, Query } from '@nestjs/common';
import { AbbonamentiService } from './abbonamenti.service';
import { CreateAbbonamentiDto } from './dto/create-abbonamenti.dto';
import { UpdateAbbonamentiDto } from './dto/update-abbonamenti.dto';
import { JwtAuthGuard } from 'src/modules/auth/jwt-auth.guard';
import { ApiOperation, ApiQuery } from '@nestjs/swagger';
import { RolesGuard } from 'src/modules/auth/roles.guard';
import { Roles } from 'src/modules/auth/roles.decorator';

@Controller('abbonamenti')
@UseGuards(JwtAuthGuard, RolesGuard) // Asegúrate de proteger estas rutas
export class AbbonamentiController {
  constructor(private readonly abbonamentiService: AbbonamentiService) { }

  @Post()
  @Roles('admin', 'Super Admin')
  create(@Body() createAbbonamentiDto: any) {
    return this.abbonamentiService.create(createAbbonamentiDto);
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
    const { abbon, total } = await this.abbonamentiService.getAbonamenti(search, page, limit, sort, order);

    return {
      data: abbon,
      total: total,
      page: page,
      limit: limit,
      totalPages: Math.ceil(total / limit)
    };
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.abbonamentiService.findOne(+id);
  }

  @Patch(':id')
  @Roles('admin', 'Super Admin')
  update(@Param('id') id: string, @Body() updateAbbonamentiDto: any) {
    return this.abbonamentiService.update(+id, updateAbbonamentiDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.abbonamentiService.remove(+id);
  }
}
