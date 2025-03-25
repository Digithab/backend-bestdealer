import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { LogService } from './log.service';

@Controller('log')
export class LogController {
  constructor(private readonly logService: LogService) { }

  @Post()
  async create(@Body() createLogDto: any) {
    const { operazione, record_table, record_id, oldVal, newVal } = createLogDto;
    return await this.logService.create(operazione, record_table, record_id, oldVal, newVal);
  }
}
