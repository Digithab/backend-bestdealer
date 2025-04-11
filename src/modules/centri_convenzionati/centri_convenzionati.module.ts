import { Module } from '@nestjs/common';
import { CentriConvenzionatiService } from './centri_convenzionati.service';
import { CentriConvenzionatiController } from './centri_convenzionati.controller';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [UsersModule],
  controllers: [CentriConvenzionatiController],
  providers: [CentriConvenzionatiService],
})
export class CentriConvenzionatiModule {}
