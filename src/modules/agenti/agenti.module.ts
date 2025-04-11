import { Module } from '@nestjs/common';
import { AgentiService } from './agenti.service';
import { AgentiController } from './agenti.controller';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [UsersModule],
  controllers: [AgentiController],
  providers: [AgentiService],
})
export class AgentiModule {}
