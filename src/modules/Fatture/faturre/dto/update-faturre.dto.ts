import { PartialType } from '@nestjs/swagger';
import { CreateFaturreDto } from './create-faturre.dto';

export class UpdateFaturreDto extends PartialType(CreateFaturreDto) {}
