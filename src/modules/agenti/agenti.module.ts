import { Module } from '@nestjs/common';
import { AgentiService } from './agenti.service';
import { AgentiController } from './agenti.controller';

@Module({
  controllers: [AgentiController],
  providers: [AgentiService],
})
export class AgentiModule {}
