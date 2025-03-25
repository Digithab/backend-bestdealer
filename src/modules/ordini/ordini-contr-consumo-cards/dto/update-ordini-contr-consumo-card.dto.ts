import { PartialType } from '@nestjs/swagger';
import { CreateOrdiniContrConsumoCardDto } from './create-ordini-contr-consumo-card.dto';

export class UpdateOrdiniContrConsumoCardDto extends PartialType(CreateOrdiniContrConsumoCardDto) {}
