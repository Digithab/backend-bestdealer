import { PartialType } from '@nestjs/swagger';
import { CreateAbbonamentiDto } from './create-abbonamenti.dto';

export class UpdateAbbonamentiDto extends PartialType(CreateAbbonamentiDto) {}
