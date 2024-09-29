export interface Fornitori {
    tipo_persona?: boolean | string;  // Requerido y booleano
    denominazione?: string;           // Requerido, string, máximo 50 caracteres
    tipo_fornitore?: any;
    stato?: boolean;                  // Requerido y booleano
    comune?: number;                 // Opcional, número
    codfisc_piva?: string;           // Opcional, string, máximo 16 caracteres
    telefono?: string;               // Opcional, string, máximo 10 caracteres
    indirizzo?: string;              // Opcional, string, máximo 75 caracteres
    email?: string;                  // Opcional, debe ser un email válido
    pec?: string;                    // Opcional, debe ser un email válido
    cap?: string;                    // Opcional, string, máximo 5 caracteres
    cod_univoco?: string;            // Opcional, string, máximo 7 caracteres
    commento?: string;               // Opcional, string, máximo 1000 caracteres
    is_deleted?: boolean;
}