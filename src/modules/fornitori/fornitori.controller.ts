import { Controller, Get, Post, Body, Patch, Param, Delete, UseFilters, ValidationPipe, NotFoundException, Query, UseGuards } from '@nestjs/common';
import { FornitoriService } from './fornitori.service';
import { IsInt, IsPositive } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { HttpExceptionFilter } from 'src/filters/http-exception.filter';
import { Fornitori } from './interface/fornitori.interface';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

class IdParam {
  @IsInt()
  @IsPositive()
  @Transform(({ value }) => parseInt(value, 10))
  id: number;
}

@ApiTags('Fornitori')
@Controller('fornitori')
@UseGuards(JwtAuthGuard) // Asegúrate de proteger estas rutas
@UseFilters(new HttpExceptionFilter())
export class FornitoriController {
  constructor(private readonly fornitoriService: FornitoriService) { }

  @Post()
  create(@Body() createFornitoriDto: any) {
    return this.fornitoriService.create(createFornitoriDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get fornitori with optional filters and pagination' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'sort', required: false, type: String })
  @ApiQuery({ name: 'order', required: false, enum: ['ASC', 'DESC'] })
  async getFornitori(
    @Query() search: Fornitori,
    @Query('page') page: number,
    @Query('limit') limit: number,
    @Query('sort') sort?: string,
    @Query('order') order?: 'ASC' | 'DESC'
  ) {

    console.log('Llega aqui')
    const { fornitori, total } = await this.fornitoriService.getFornitori(search, page, limit, sort, order);

    return {
      data: fornitori,
      total: total,
      page: page,
      limit: limit,
      totalPages: Math.ceil(total / limit)
    };
  }

  @Get(':id')
  async findOne(@Param(ValidationPipe) { id }: IdParam) {

    const fornitori = await this.fornitoriService.findOne(+id);

    if (!fornitori) {
      throw new NotFoundException(`Fornitori with ID ${id} not found`);
    }

    return fornitori
  }

  @Patch(':id')
  async update(
    @Param(ValidationPipe) { id }: IdParam,
    @Body(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true })) updateFornitoriDto: any
  ) {
    const fornitori = await this.fornitoriService.update(+id, updateFornitoriDto);

    if (!fornitori) {
      throw new NotFoundException(`Fornitori with ID ${id} not found`);
    }

    return fornitori
  }

  @Delete(':id')
  async remove(@Param(ValidationPipe) { id }: IdParam) {

    const isDelete = await this.fornitoriService.remove(+id);

    if (!isDelete) {
      throw new NotFoundException(`Fornitori with ID ${id} not found`);
    }

    return isDelete
  }
}
