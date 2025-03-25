import { Injectable } from '@nestjs/common';
import { CreateCondizioniGeneraliDto } from './dto/create-condizioni-generali.dto';
import { UpdateCondizioniGeneraliDto } from './dto/update-condizioni-generali.dto';

@Injectable()
export class CondizioniGeneraliService {
  create(createCondizioniGeneraliDto: CreateCondizioniGeneraliDto) {
    return 'This action adds a new condizioniGenerali';
  }

  findAll() {
    return `This action returns all condizioniGenerali`;
  }

  findOne(id: number) {
    return `This action returns a #${id} condizioniGenerali`;
  }

  update(id: number, updateCondizioniGeneraliDto: UpdateCondizioniGeneraliDto) {
    return `This action updates a #${id} condizioniGenerali`;
  }

  remove(id: number) {
    return `This action removes a #${id} condizioniGenerali`;
  }
}
