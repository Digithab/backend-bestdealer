export class CreateEventDto {
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
