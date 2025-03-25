import { IsInt, IsString, IsBoolean, IsEmail, IsOptional, Min, Max, IsDateString, IsIn, Matches, ValidateNested } from 'class-validator';
import { Dealer } from '../interface/dealer-interface';



export class CreateDealerDto {
    dealer: Dealer

}