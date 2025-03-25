import {
  Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Query, Request

} from '@nestjs/common';
import { DisponibilitaPacchettiService } from './disponibilita_pacchetti.service';
import { CreateDisponibilitaPacchettiDto } from './dto/create-disponibilita_pacchetti.dto';
import { UpdateDisponibilitaPacchettiDto } from './dto/update-disponibilita_pacchetti.dto';
import { JwtAuthGuard } from 'src/modules/auth/jwt-auth.guard';

@Controller('guarantees/disponibilita-pacchetti')
@UseGuards(JwtAuthGuard) // Asegúrate de proteger estas rutas
export class DisponibilitaPacchettiController {
  constructor(private readonly disponibilitaPacchettiService: DisponibilitaPacchettiService) { }

  @Get()
  @UseGuards(JwtAuthGuard) // Asegúrate de proteger estas rutas  
  async getAllDisponibilita() {
    return await this.disponibilitaPacchettiService.getAllDisponibilita();
  }

  @Get('search')
  async getAllDisponibilitaSearch(
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
    @Query('id') id?: string,
    @Query('sigla') sigla?: string
  ) {
    return await this.disponibilitaPacchettiService.getAllDisponibilitaSearch(
      page,
      limit,
      id,
      sigla,
    );
  }

  @Post('notification')
  create(@Body() sel: any, @Request() req,) {
    console.log('sel', sel)
    const email = req.email.email
    return this.disponibilitaPacchettiService.actionNotificaSelezionati(sel, email);
  }

  // @Get()
  // findAll() {
  //   return this.disponibilitaPacchettiService.findAll();
  // }

  // @Get(':id')
  // findOne(@Param('id') id: string) {
  //   return this.disponibilitaPacchettiService.findOne(+id);
  // }

  // @Patch(':id')
  // update(@Param('id') id: string, @Body() updateDisponibilitaPacchettiDto: UpdateDisponibilitaPacchettiDto) {
  //   return this.disponibilitaPacchettiService.update(+id, updateDisponibilitaPacchettiDto);
  // }

  // @Delete(':id')
  // remove(@Param('id') id: string) {
  //   return this.disponibilitaPacchettiService.remove(+id);
  // }
}
