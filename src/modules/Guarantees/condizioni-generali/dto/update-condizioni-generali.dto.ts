import { PartialType } from '@nestjs/swagger';
import { CreateCondizioniGeneraliDto } from './create-condizioni-generali.dto';

export class UpdateCondizioniGeneraliDto extends PartialType(CreateCondizioniGeneraliDto) {}
