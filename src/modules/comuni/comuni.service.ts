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
    
    let query = 'SELECT cm.id as value, cm.citta as label,  cm.* FROM comuni cm';

    let params: any[] = [];

    if (search && search.trim() !== '') {
      const searchTerm = search.trim();

      // Si el término de búsqueda es numérico, buscar por ID exacto o citta
      if (/^\d+$/.test(searchTerm)) {
        query += ' WHERE cm.id = ? OR cm.citta LIKE ?';
        params.push(searchTerm, `%${searchTerm}%`);
      } else {
        // Si no es numérico, buscar solo por citta
        query += ' WHERE cm.citta LIKE ?';
        params.push(`%${searchTerm}%`);
      }

      query += ' LIMIT 50';
    } else {
      query += ' LIMIT 50';
    }



    const items = await this.entityManager.query(
      query, params
    )

    return items;
  }

  findOne(id: number) {
    return `This action returns a #${id} comuni`;
  }

}
