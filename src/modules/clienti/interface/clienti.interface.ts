export interface Clienti {
    id?: number;
    denominazione?: string;
    agente?: number;
    tipo_persona?: boolean; // true => Persona Giuridica, false => Persona Fisica
    comune?: number;
    cap?: string;
    prov?: string;
    frazione?: string;
    indirizzo?: string;
    civico?: string;
    cellulare?: string;
    email?: string;
    pec?: string;
    cod_univoco?: string;
    codfisc_piva?: string;
    abilitazione_proforma?: boolean;
    is_deleted?: boolean;
}
