export interface PackageQuantity {
    dealer: number;
    pack_id: number;
    attivazione: Date;
    scadenza: Date;
    prodotto: number;
    tot: number;
}

export interface Garanzia {
    id: number;
    tipo_garanzia: number;
    data_attivazione: Date;
    durata: number;
}

export type DisponibilitaResult = Record<number, Record<number, number>>;