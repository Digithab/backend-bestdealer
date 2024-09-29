import { Controller, Get, Post, Body, Patch, Param, Delete, Query, ValidationPipe, NotFoundException } from '@nestjs/common';
import { CentriConvenzionatiService } from './centri_convenzionati.service';
import { UpdateCentriConvenzionatiDto } from './dto/update-centri_convenzionati.dto';
import { IsInt, IsPositive } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Officine } from './interface/officine.interface';

class IdParam {
  @IsInt()
  @IsPositive()
  @Transform(({ value }) => parseInt(value, 10))
  id: number;
}

@ApiTags('Officine Convenzionate')
@Controller('centri-convenzionati')
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
  async getAgenti(
    @Query() search: Officine,
    @Query('page') page: number,
    @Query('limit') limit: number,
    @Query('sort') sort?: string,
    @Query('order') order?: 'ASC' | 'DESC'
  ) {
    const { officine, total } = await this.centriConvenzionatiService.getAgenti(search, page, limit, sort, order);

    return {
      data: officine,
      total: total,
      page: page,
      limit: limit,
      totalPages: Math.ceil(total / limit)
    };
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
    @Param(ValidationPipe) { id }: IdParam,
    @Body(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true })) updateCentriConvenzionatiDto: UpdateCentriConvenzionatiDto) {

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
