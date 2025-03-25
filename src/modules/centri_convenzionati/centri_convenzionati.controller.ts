import { Controller, Get, Post, Body, Patch, Param, Delete, Query, ValidationPipe, NotFoundException, UseGuards } from '@nestjs/common';
import { CentriConvenzionatiService } from './centri_convenzionati.service';
import { UpdateCentriConvenzionatiDto } from './dto/update-centri_convenzionati.dto';
import { IsInt, IsPositive } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Officine } from './interface/officine.interface';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

class IdParam {
  @IsInt()
  @IsPositive()
  @Transform(({ value }) => parseInt(value, 10))
  id: number;
}

@ApiTags('Officine Convenzionate')
@Controller('centri-convenzionati')
@UseGuards(JwtAuthGuard) // Asegúrate de proteger estas rutas
export class CentriConvenzionatiController {
  constructor(private readonly centriConvenzionatiService: CentriConvenzionatiService) { }

  @Post()
  create(@Body() createCentriConvenzionatiDto: any) {
    return this.centriConvenzionatiService.create(createCentriConvenzionatiDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get agenti with optional filters and pagination' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'sort', required: false, type: String })
  @ApiQuery({ name: 'order', required: false, enum: ['ASC', 'DESC'] })
  async getOffina(
    @Query() search: Officine,
    @Query('page') page: number,
    @Query('limit') limit: number,
    @Query('sort') sort?: string,
    @Query('order') order?: 'ASC' | 'DESC'
  ) {
    const { officine, total } = await this.centriConvenzionatiService.getOffina(search, page, limit, sort, order);

    return {
      data: officine,
      total: total,
      page: page,
      limit: limit,
      totalPages: Math.ceil(total / limit)
    };
  }

  @Get('officina')
  async getOfficina() {
    return this.centriConvenzionatiService.getOfficina();
  }

  @Get('data-office')
  async dataOfficina() {
    return this.centriConvenzionatiService.dataOfficina();
  }

  @Get(':id')
  async findOne(@Param(ValidationPipe) { id }: IdParam) {

    const officine = this.centriConvenzionatiService.findOne(+id);

    if (!officine) {
      throw new NotFoundException(`Officine with ID ${id} not found`);

    }
    return officine
  }

  @Patch(':id')
  async update(
    @Param('id') id: string, @Body() updateCentriConvenzionatiDto: any) {
    console.log('id:::___', id)
    console.log('centri-convenzionati', updateCentriConvenzionatiDto)
    const Officine = await this.centriConvenzionatiService.update(+id, updateCentriConvenzionatiDto);

    if (!Officine) {

      throw new NotFoundException(`Officine with ID ${id} not found`);

    }

    return Officine
  }

  @Delete(':id')
  async remove(@Param(ValidationPipe) { id }: IdParam) {

    const isDelete = await this.centriConvenzionatiService.remove(+id);

    if (!isDelete) {
      throw new NotFoundException(`Clienti with ID ${id} not found`);
    }

    return isDelete
  }
}
