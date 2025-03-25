import { PartialType } from '@nestjs/swagger';
import { CreateSoccorsiStradaliDto } from './create-soccorsi-stradali.dto';

export class UpdateSoccorsiStradaliDto extends PartialType(CreateSoccorsiStradaliDto) {}
