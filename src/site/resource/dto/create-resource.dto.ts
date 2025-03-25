export class CreateResourceDto { }

export class CreateDto {
    file?: {
        fieldname: string;
        originalname: string;
        encoding: string;
        mimetype: string;
        buffer: Buffer;
        size: number;
    };
}
