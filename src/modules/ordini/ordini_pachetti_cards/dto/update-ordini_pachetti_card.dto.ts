import { PartialType } from '@nestjs/swagger';
import { CreateOrdiniPachettiCardDto } from './create-ordini_pachetti_card.dto';

export class UpdateOrdiniPachettiCardDto extends PartialType(CreateOrdiniPachettiCardDto) {}
