import { PartialType } from '@nestjs/mapped-types';
import { CreateAgentiDto } from './create-agenti.dto';

export class UpdateAgentiDto extends PartialType(CreateAgentiDto) {}
