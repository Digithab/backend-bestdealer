import { Module } from '@nestjs/common';
import { CentriConvenzionatiService } from './centri_convenzionati.service';
import { CentriConvenzionatiController } from './centri_convenzionati.controller';

@Module({
  controllers: [CentriConvenzionatiController],
  providers: [CentriConvenzionatiService],
})
export class CentriConvenzionatiModule {}
