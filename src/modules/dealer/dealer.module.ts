import { Module } from '@nestjs/common';
import { DealerService } from './dealer.service';
import { DealerController } from './dealer.controller';

@Module({
  controllers: [DealerController],
  providers: [DealerService],
})
export class DealerModule {}
