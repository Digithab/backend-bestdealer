import { PartialType } from '@nestjs/swagger';
import { CreateGenPdfDto } from './create-gen-pdf.dto';

export class UpdateGenPdfDto extends PartialType(CreateGenPdfDto) {}
