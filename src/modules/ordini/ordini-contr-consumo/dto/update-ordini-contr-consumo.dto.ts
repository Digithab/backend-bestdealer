import { PartialType } from '@nestjs/swagger';
import { CreateOrdiniContrConsumoDto } from './create-ordini-contr-consumo.dto';

export class UpdateOrdiniContrConsumoDto extends PartialType(CreateOrdiniContrConsumoDto) {}
