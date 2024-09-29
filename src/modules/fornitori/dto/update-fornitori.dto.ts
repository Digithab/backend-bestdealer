import { PartialType } from '@nestjs/swagger';
import { CreateFornitoriDto } from './create-fornitori.dto';

export class UpdateFornitoriDto extends PartialType(CreateFornitoriDto) {}
