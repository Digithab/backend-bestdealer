export interface Garantia {
    id?: number;
    data_attivazione: string;
    durata: number;
    data_scadenza: string;
    dealer: number;
    agente: number;
    venditore?: number;
    tipo_garanzia: number;
    certificato_conformita: boolean;
    soccorso__km: number;
    soccorso__auto_sostitutiva: boolean;
    stato: number;
    id_proforma: number;
    id_proforma_soccorso: number;
    consumo_pack: number;
    consumo_pack_soccorso: number;
    consumo_pack_autosost: number;
    is_deleted: boolean;
    veicolo?: number;
    proprietario?: number;
    data_inserimento?: string;
}

export interface Vehiculo {
    id?: number;
    cliente: string,
    targa: string
    marca_select: string,
    modello_select: string
    tipo: number
    cilindrata: number
    km: number
    immatricolazione: string
    reimmatricolazione: number
    targa_originaria: number
    prima_immatricolazione: string
    alimentazione: string
    cambio: string
    trazione: string;
    codice_qr: string;
}

export interface Cliente {
    id?: number;
    denominazione: string;
    indirizzo: string;
    agente: number;
    abilitazione_proforma: boolean;
    is_deleted: boolean;
}

export interface User {
    [x: string]: any;
    id: string;
    role: string;
    permissions?: string[];
}

export class SaveCommentoDto {
    newCommento: string;
    newCommentoGaranziaId: number;
}


export interface Dealer {
    id: number;
    agente: number;
    denominazione: string;
    data_proforma_singole_garanzie: boolean;
    pagamento__rate: number;
    pagamento__differita: number;
    pagamento__periodo: number;
}
