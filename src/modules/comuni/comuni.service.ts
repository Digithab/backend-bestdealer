import { Injectable } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';
import { Comuni } from './interface/comuni.interface';

@Injectable()
export class ComuniService {

  constructor(

    @InjectEntityManager() private entityManager: EntityManager

  ) { }

  async findByCity(search: string): Promise<Comuni> {

    let query = 'SELECT * FROM comuni';

    let params: any[] = [];

    if (search && search.trim() !== '') {

      query += ' WHERE citta LIKE ?';

      params.push(`%${search.trim()}%`);

    }

    query += ' LIMIT 20'

    const items = await this.entityManager.query(
      query, params
    )

    return items;
  }

  findOne(id: number) {
    return `This action returns a #${id} comuni`;
  }

}
