import { PartialType } from '@nestjs/swagger';
import { CreateDisponibilitaPacchettiCardDto } from './create-disponibilita_pacchetti_card.dto';

export class UpdateDisponibilitaPacchettiCardDto extends PartialType(CreateDisponibilitaPacchettiCardDto) {}
