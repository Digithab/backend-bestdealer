import { PartialType } from '@nestjs/swagger';
import { CreateOrdiniPachettiDto } from './create-ordini_pachetti.dto';

export class UpdateOrdiniPachettiDto extends PartialType(CreateOrdiniPachettiDto) {}
