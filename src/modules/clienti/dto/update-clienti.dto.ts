import { PartialType } from '@nestjs/mapped-types';
import { CreateClientiDto } from './create-clienti.dto';

export class UpdateClientiDto extends PartialType(CreateClientiDto) {}
