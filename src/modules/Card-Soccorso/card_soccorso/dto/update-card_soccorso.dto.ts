import { PartialType } from '@nestjs/swagger';
import { CreateCardSoccorsoDto } from './create-card_soccorso.dto';

export class UpdateCardSoccorsoDto extends PartialType(CreateCardSoccorsoDto) {}
