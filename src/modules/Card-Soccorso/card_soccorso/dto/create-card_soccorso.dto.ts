
export class CreateCardSoccorsoDto {
    data: {
        Veicoli: {
            cliente: string,
            targa: string
            marca: any,
            modello: any
            tipo: number
            cilindrata: number
            km: number
            immatricolazione: string
            reimmatricolazione: number
            targa_originaria: string
            prima_immatricolazione: string
            alimentazione: string
            cambio: string
            trazione: string;
            codice_qr: string;
        }

        Clienti: {
            tipo_persona: number;
            denominazione: string;
            agente: string;
            comune: number;
            prov: string;
            cap: number;
            frazione: string
            indirizzo: string;
            civico: string;
            cellulare: number;
            email: string;
            abilitazione_proforma: boolean;
        };
        CardSoccorso: {
            veicolo?: string;
            proprietario?: string;
            dealer?: string;
            venditore?: string;
            data_inserimento: any;
            data_attivazione: any;
            data_scadenza: any;
            id_proforma?: number;
            id_proforma_restituzione?: number;
            tipo_card?: string;
            restituzione?: number;
            num_soccorsi?: string;
            stato?: number;
            is_deleted?: boolean;
            agente: string;
        };
    }

}
