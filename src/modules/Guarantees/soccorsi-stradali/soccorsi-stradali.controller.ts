import { Controller, Get, Post, Body, Patch, Param, Delete, Query, Render } from '@nestjs/common';
import { SoccorsiStradaliService } from './soccorsi-stradali.service';
import { CreateSoccorsiStradaliDto } from './dto/create-soccorsi-stradali.dto';
import { UpdateSoccorsiStradaliDto } from './dto/update-soccorsi-stradali.dto';
import { Stradali } from './interface/stradali.interface';
import { ApiOperation, ApiQuery } from '@nestjs/swagger';

export interface SearchDto {
  search: {
    targa: string;
    garanzia: string;
    proprietario: string;
  };
}

@Controller('guarantees/soccorsi-stradali')
export class SoccorsiStradaliController {
  constructor(private readonly soccorsiStradaliService: SoccorsiStradaliService) { }

  @Post()
  create(@Body() createSoccorsiStradaliDto: CreateSoccorsiStradaliDto) {
    return this.soccorsiStradaliService.create(createSoccorsiStradaliDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get agenti with optional filters and pagination' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'sort', required: false, type: String })
  @ApiQuery({ name: 'order', required: false, enum: ['ASC', 'DESC'] })
  async getStradali(
    @Query() search: Stradali,
    @Query('page') page: number,
    @Query('limit') limit: number,
    @Query('sort') sort?: string,
    @Query('order') order?: 'ASC' | 'DESC'
  ) {
    const { stradali, total } = await this.soccorsiStradaliService.getStradali(search, page, limit, sort, order);

    return {
      data: stradali,
      total: total,
      page: page,
      limit: limit,
      totalPages: Math.ceil(total / limit)
    };
  }

  @Post('search')
  async search(
    @Body() queryParams: SearchDto,
  ) {


    const results = await this.soccorsiStradaliService.search(queryParams.search);

    return {
      items: results,
    };
  }


  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.soccorsiStradaliService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateSoccorsiStradaliDto: UpdateSoccorsiStradaliDto) {
    return this.soccorsiStradaliService.update(+id, updateSoccorsiStradaliDto);
  }
}
