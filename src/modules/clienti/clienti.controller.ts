import { Controller, Get, Post, Body, Patch, Param, Delete, Query, UseFilters, ValidationPipe, NotFoundException } from '@nestjs/common';
import { ClientiService } from './clienti.service';
import { CreateClientiDto } from './dto/create-clienti.dto';
import { UpdateClientiDto } from './dto/update-clienti.dto';
import { Clienti } from './interface/clienti.interface';
import { IsInt, IsPositive } from 'class-validator';
import { Transform } from 'class-transformer';
import { HttpExceptionFilter } from 'src/filters/http-exception.filter';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';

class IdParam {
  @IsInt()
  @IsPositive()
  @Transform(({ value }) => parseInt(value, 10))
  id: number;
}

@ApiTags('Clienti')
@Controller('clienti')
@UseFilters(new HttpExceptionFilter())
export class ClientiController {
  constructor(private readonly clientiService: ClientiService) { }

  @Post()
  create(@Body() createClientiDto: CreateClientiDto) {
    return this.clientiService.create(createClientiDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get agenti with optional filters and pagination' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'sort', required: false, type: String })
  @ApiQuery({ name: 'order', required: false, enum: ['ASC', 'DESC'] })
  async getAgenti(
    @Query() search: Clienti,
    @Query('page') page: number,
    @Query('limit') limit: number,
    @Query('sort') sort?: string,
    @Query('order') order?: 'ASC' | 'DESC'
  ) {
    const { clienti, total } = await this.clientiService.getAgenti(search, page, limit, sort, order);

    return {
      data: clienti,
      total: total,
      page: page,
      limit: limit,
      totalPages: Math.ceil(total / limit)
    };
  }


  @Get(':id')
  async findOne(@Param(ValidationPipe) { id }: IdParam) {

    const clienti = await this.clientiService.findOne(+id)

    if (!clienti) {
      throw new NotFoundException(`Cliente with ID ${id} not found`);
    }
    return clienti;
  }

  @Patch(':id')
  async update(
    @Param(ValidationPipe) { id }: IdParam,
    @Body(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true })) updateClientiDto: UpdateClientiDto
  ) {
    const clienti = this.clientiService.update(+id, updateClientiDto)

    if (!clienti) {
      throw new NotFoundException(`Cliente with ID ${id} not found`);

    }
    return clienti;
  }

  @Delete(':id')
  async remove(@Param(ValidationPipe) { id }: IdParam) {

    const isDelete = await this.clientiService.remove(+id);

    if (!isDelete) {
      throw new NotFoundException(`Clienti with ID ${id} not found`);
    }

    return isDelete;
  }
}
