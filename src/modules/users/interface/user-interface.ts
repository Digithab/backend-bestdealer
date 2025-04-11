
export class User {

    id?: number
    agente?: string;
    email: string;
    username: string;
    password: string;
    role: string;
    permissions?: string[]; // Añadir permisos
    sigla?: string;

}