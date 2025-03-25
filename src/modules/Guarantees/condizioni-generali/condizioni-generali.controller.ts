import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { CondizioniGeneraliService } from './condizioni-generali.service';
import { CreateCondizioniGeneraliDto } from './dto/create-condizioni-generali.dto';
import { UpdateCondizioniGeneraliDto } from './dto/update-condizioni-generali.dto';

@Controller('guarantees/condizioni-generali')
export class CondizioniGeneraliController {
  constructor(private readonly condizioniGeneraliService: CondizioniGeneraliService) { }

  @Post()
  create(@Body() createCondizioniGeneraliDto: CreateCondizioniGeneraliDto) {
    return this.condizioniGeneraliService.create(createCondizioniGeneraliDto);
  }

  @Get()
  findAll() {
    return this.condizioniGeneraliService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.condizioniGeneraliService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateCondizioniGeneraliDto: UpdateCondizioniGeneraliDto) {
    return this.condizioniGeneraliService.update(+id, updateCondizioniGeneraliDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.condizioniGeneraliService.remove(+id);
  }
}
