import { PartialType } from '@nestjs/swagger';
import { CreateDisponibilitaPacchettiDto } from './create-disponibilita_pacchetti.dto';

export class UpdateDisponibilitaPacchettiDto extends PartialType(CreateDisponibilitaPacchettiDto) {}
