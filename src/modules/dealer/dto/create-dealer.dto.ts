import { IsInt, IsString, IsBoolean, IsEmail, IsOptional, Min, Max, IsDateString, IsIn, Matches, ValidateNested } from 'class-validator';


export class CreateDealerDto {

    @IsInt()
    @Min(1)
    id: number;

    @IsInt()
    @IsIn([1, 2])
    tipo_persona: number;

    @IsString()
    denominazione: string;

    @IsString()
    @Matches(/^[0-9]{5}$/)
    cap: string;

    @IsInt()
    @Min(1)
    comune: number;

    @IsString()
    @IsOptional()
    frazione: string;

    @IsString()
    indirizzo: string;

    @IsString()
    civico: string;

    @IsEmail()
    email: string;

    @IsString()
    @Matches(/^[A-Z]{6}[0-9]{2}[A-Z][0-9]{2}[A-Z][0-9]{3}[A-Z]$/)
    cod_fiscale: string;

    @IsString()
    @Matches(/^[0-9]{11}$/)
    partita_iva: string;

    @IsString()
    @IsOptional()
    cod_univoco: string;

    @IsEmail()
    @IsOptional()
    pec: string;

    @IsString()
    @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/)
    password: string;

    @IsInt()
    @Min(0)
    @Max(1)
    stato: number;

    @IsString()
    @IsOptional()
    commento: string;

    @IsInt()
    @Min(1)
    agente: number;

    @IsBoolean()
    card_soccorso: boolean;

    @IsString()
    @IsOptional()
    istituto: string;

    @IsString()
    @IsOptional()
    @Matches(/^[A-Z]{6}[A-Z2-9][A-NP-Z0-9]([A-Z0-9]{3}){0,1}$/)
    bic: string;

    @IsString()
    @IsOptional()
    @Matches(/^[A-Z]{2}[0-9]{2}[A-Z0-9]{1,30}$/)
    iban: string;


    @IsString()
    @IsOptional()
    km: string;

    @IsBoolean()
    @IsOptional()
    auto_sost: boolean;

    @IsString()
    @IsOptional()
    num_traini: string;

    @IsDateString()
    data_iscrizione: string;

    @IsInt()
    @IsOptional()
    @Min(1)
    rate: number;

    @IsInt()
    @IsOptional()
    @Min(0)
    differita: number;

    @IsInt()
    @IsOptional()
    @Min(1)
    periodo: number;

    @IsBoolean()
    data: boolean;

    @IsBoolean()
    data_proforma_singole_garanzie: boolean;

}