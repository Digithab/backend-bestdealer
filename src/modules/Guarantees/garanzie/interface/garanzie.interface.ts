export interface getGaranzie {
    id?: number;
    agente?: string;
    dealer?: number;
    venditore?: boolean; // true => Persona Giuridica, false => Persona Fisica
    garanzie?: number;
    DDC?: number;
    data_inserimento?: string;
    data_attivazione?: string;
    data_scadenza?: string;
    durata?: number;
    propietario?: string;
    tel?: string;
    targa?: string;
    km?: number;
    num_guasti?: number;
}

