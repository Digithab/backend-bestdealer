import { PartialType } from '@nestjs/swagger';
import { CreateGuastiDto } from './create-guasti.dto';

export class UpdateGuastiDto extends PartialType(CreateGuastiDto) {
    garanzie: string | undefined;
    stato: number;
    data_guasto: string;

    // Opzioni Garanzie
    descrizione: string;
    preventivo_riparazione: number;
    costo_riparazione: number;
    costo_dealer: number;
}
