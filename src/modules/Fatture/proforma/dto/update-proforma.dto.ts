import { PartialType } from '@nestjs/swagger';
import { CreateProformaDto } from './create-proforma.dto';

export class UpdateProformaDto extends PartialType(CreateProformaDto) {}
