import { Module } from '@nestjs/common';
import { CondizioniGeneraliService } from './condizioni-generali.service';
import { CondizioniGeneraliController } from './condizioni-generali.controller';

@Module({
  controllers: [CondizioniGeneraliController],
  providers: [CondizioniGeneraliService],
})
export class CondizioniGeneraliModule {}
