import { IsNotEmpty, IsNumber, IsOptional, IsString } from "class-validator";

export class CreateGarantiaDto {
    extend?: number;
    @IsNotEmpty()
    Veicoli: {
        cliente: string,
        targa: string
        marca_select: any,
        modello_select: any
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

    @IsNotEmpty()
    Clienti: {
        tipo_persona: number;
        denominazione: string;
        comune: number;
        prov: string;
        cap: number;
        frazione: string
        indirizzo: string;
        civico: string;
        cellulare: number;
        email: string
    };
    Garanzie: {
        commento: string
        agente: number
        dealer: number
        venditore: number | any
        tipo_garanzia: number
        data_attivazione: string
        durata: number,
        stato: number,  // Solo se "stato" es único
        data_scadenza: string
        soccorso__km: number
        certificato_conformita: boolean
        soccorso__auto_sostitutiva: number
        veicolo: string,
        proprietario: number,
        id_proforma: number,
        id_proforma_soccorso: number,
        id_proforma_autosost: number,
        consumo_pack: number,
        consumo_pack_soccorso: number,
        consumo_pack_autosost: number,
        data_inserimento: string,
        is_deleted: boolean

    }
    static Garanzie: any;
}

export interface GarantiaServiceData {
    // Datos del DTO
    Veicoli: CreateGarantiaDto['Veicoli'];
    Clienti: CreateGarantiaDto['Clienti'];
    Garanzie: CreateGarantiaDto['Garanzie'] & {
        // Campos adicionales que necesitas enviar
        data_inserimento: string;
        id_proforma: number;
        id_proforma_soccorso: number;
        id_proforma_autosost: number;
        consumo_pack: number;
        consumo_pack_soccorso: number;
        consumo_pack_autosost: number;
        is_deleted: boolean;
    }
}
