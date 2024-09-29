import { Module } from '@nestjs/common';
import { ComuniService } from './comuni.service';
import { ComuniController } from './comuni.controller';

@Module({
  controllers: [ComuniController],
  providers: [ComuniService],
})
export class ComuniModule {}
