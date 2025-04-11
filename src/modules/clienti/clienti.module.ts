import { Module } from '@nestjs/common';
import { ClientiService } from './clienti.service';
import { ClientiController } from './clienti.controller';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [UsersModule],
  controllers: [ClientiController],
  providers: [ClientiService],
})
export class ClientiModule {}
