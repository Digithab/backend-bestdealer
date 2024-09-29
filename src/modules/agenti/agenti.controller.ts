import { Controller, Get, Post, Body, Patch, Param, Delete, Query, UseFilters, ValidationPipe, NotFoundException } from '@nestjs/common';
import { AgentiService } from './agenti.service';
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

@ApiTags('Agenti')
@Controller('agenti')
@UseFilters(new HttpExceptionFilter())
export class AgentiController {
  constructor(private readonly agentiService: AgentiService) { }

  @Post()
  create(@Body() createAgentiDto: any) {
    console.log('createAgentiDto:: ', createAgentiDto)
    return this.agentiService.create(createAgentiDto);
  }

  // @Get('search')
  // async search(
  //   @Query() search: AgentiSearch,
  //   @Query('page') page: number = 1,
  //   @Query('limit') limit: number = 20,
  // ) {

  //   const { agenti, total } = await this.agentiService.search(search, page, limit)

  //   return {
  //     data: agenti,
  //     total: total,
  //     page: page,
  //     limit: limit,
  //     totalPages: Math.ceil(total / limit)
  //   }
  // }

  // @Get()
  // findAll(
  //   @Query() sort: string,
  //   @Query('order') order: any,
  // ) {
  //   return this.agentiService.findAll(sort, order);
  // }

  @Get()
  @ApiOperation({ summary: 'Get agenti with optional filters and pagination' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'sort', required: false, type: String })
  @ApiQuery({ name: 'order', required: false, enum: ['ASC', 'DESC'] })
  async getAgenti(
    @Query() search: AgentiSearch,
    @Query('page') page: number,
    @Query('limit') limit: number,
    @Query('sort') sort?: string,
    @Query('order') order?: 'ASC' | 'DESC'
  ) {
    const { agenti, total } = await this.agentiService.getAgenti(search, page, limit, sort, order);

    return {
      data: agenti,
      total: total,
      page: page,
      limit: limit,
      totalPages: Math.ceil(total / limit)
    };
  }

  @Get(':id')
  async findOne(@Param(ValidationPipe) { id }: IdParam) {
    const agenti = await this.agentiService.findOne(id);
    if (!agenti) {
      throw new NotFoundException(`Agenti with ID ${id} not found`);
    }
    return agenti;
  }

  @Patch(':id')
  async update(
    @Param(ValidationPipe) { id }: IdParam,
    @Body(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true })) updateClientiDto: any
  ) {
    const updatedAgenti = await this.agentiService.update(id, updateClientiDto);
    if (!updatedAgenti) {
      throw new NotFoundException(`Agenti with ID ${id} not found`);
    }
    return updatedAgenti;
  }

  @Delete(':id')
  async remove(@Param(ValidationPipe) { id }: IdParam) {

    const isDelete = await this.agentiService.remove(+id)

    if (!isDelete) {
      throw new NotFoundException(`Agenti with ID ${id} not found`);
    }
    return isDelete;
  }
}
