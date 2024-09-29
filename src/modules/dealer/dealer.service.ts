import { ForbiddenException, Injectable } from '@nestjs/common';
import { CreateDealerDto } from './dto/create-dealer.dto';
import { UpdateDealerDto } from './dto/update-dealer.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Dealer } from './interface/dealer-interface';
import { Repository } from 'typeorm';

@Injectable()
export class DealerService {

  constructor(

    @InjectRepository(Dealer)

    private dealersRepository: Repository<Dealer>

  ) { }

  async search(searchParams: any, page: number = 1, limit: number = 10, userRole: string, userId: string) {

    const query = this.dealersRepository.createQueryBuilder('dealers');

    switch (userRole) {
      case 'admin':

        if (searchParams.id) {

          let dealer: any

          dealer = await this.findOne(searchParams.id);

          if (dealer) {
            return { redirectTo: `/dealers/update/${dealer.id}`, dealer };
          }
        }

        break;
      case 'agente':

        const agentId = userId.split('-')[0];

        query.andWhere('dealer.agente = :agente', { agente: agentId });

        break;

      default:
        throw new ForbiddenException('Access denied');
    }

    if (searchParams.id) query.andWhere('dealer.id = :id', { id: searchParams.id });

    query.skip((page - 1) * limit)
      .take(limit)

    const [items, total] = await query.getManyAndCount();

    return {
      items,
      total,
      page,
      lastPage: Math.ceil(total / limit)
    }

  }

  create(createDealerDto: CreateDealerDto) {
    return 'This action adds a new dealer';
  }

  findAll() {
    return `This action returns all dealer`;
  }

  async findOne(id: number) {

    return await this.dealersRepository.findOne({ where: { id } });
  }

  update(id: number, updateDealerDto: UpdateDealerDto) {
    return `This action updates a #${id} dealer`;
  }

  remove(id: number) {
    
    return `This action removes a #${id} dealer`;
  }
}
