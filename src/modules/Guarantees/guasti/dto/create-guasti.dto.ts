import { Transform } from "class-transformer";

export class CreateGuastiDto {

    // Data Guasto
    @Transform(({ value }) => JSON.parse(value))
    guasti: {
        garanzie: string | undefined;
        stato: number;
        data_guasto: string;

        // Opzioni Garanzie
        descrizione: string;
        preventivo_riparazione: number;
        costo_riparazione: number;
        costo_dealer: number;
    }
    data: string;
    note: string;
    allegato?: string;
    guasto: string;
    estensione_file: string
    file?: {
        fieldname: string;
        originalname: string;
        encoding: string;
        mimetype: string;
        buffer: Buffer;
        size: number;
    };

}
