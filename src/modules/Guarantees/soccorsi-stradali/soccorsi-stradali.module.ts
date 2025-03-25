import { Module } from '@nestjs/common';
import { SoccorsiStradaliService } from './soccorsi-stradali.service';
import { SoccorsiStradaliController } from './soccorsi-stradali.controller';

@Module({
  controllers: [SoccorsiStradaliController],
  providers: [SoccorsiStradaliService],
})
export class SoccorsiStradaliModule {}
