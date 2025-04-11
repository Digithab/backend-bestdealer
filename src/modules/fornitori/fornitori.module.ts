import { Module } from '@nestjs/common';
import { FornitoriService } from './fornitori.service';
import { FornitoriController } from './fornitori.controller';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [UsersModule], 
  controllers: [FornitoriController],
  providers: [FornitoriService],
})
export class FornitoriModule {}
