import { Controller, Get, Post, Body, Patch, Param, Delete, Query, UseGuards } from '@nestjs/common';
import { ComuniService } from './comuni.service';
import { ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@ApiTags('Comuni  ')
@Controller('comuni')
export class ComuniController {
  constructor(private readonly comuniService: ComuniService) { }

  @Get()
  findByCity(@Query('search') search?: string) {
    return this.comuniService.findByCity(search);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.comuniService.findOne(+id);
  }

}
