import { PartialType } from '@nestjs/swagger';
import { CreateCentriConvenzionatiDto } from './create-centri_convenzionati.dto';

export class UpdateCentriConvenzionatiDto extends PartialType(CreateCentriConvenzionatiDto) {}
