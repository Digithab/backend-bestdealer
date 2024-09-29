import { Module } from '@nestjs/common';
import { FornitoriService } from './fornitori.service';
import { FornitoriController } from './fornitori.controller';

@Module({
  controllers: [FornitoriController],
  providers: [FornitoriService],
})
export class FornitoriModule {}
