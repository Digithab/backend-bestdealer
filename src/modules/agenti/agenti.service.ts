import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateAgentiDto } from './dto/create-agenti.dto';
import { UpdateAgentiDto } from './dto/update-agenti.dto';
import { InjectDataSource, InjectEntityManager } from '@nestjs/typeorm';
import { DataSource, EntityManager, SelectQueryBuilder } from 'typeorm';

export const AgentiSearchKeys = [
  'sigla',
  'tipo_persona',
  'denominazione',
  'cellulare',
  'cap',
  'nomecomune',
  'provincia',
  'indirizzo',
  'zona',
  'provvigioni__best',
  'provvigioni__gest',
  'provvigioni__ddc',
  'provvigioni__addons',
  'provvigioni__cards',
  'provvigioni__altro'
]

@Injectable()
export class AgentiService {

  constructor(

    @InjectEntityManager() private entityManager: EntityManager,

    @InjectDataSource() private dataSource: DataSource

  ) { }

  async create(createAgentiDto: any): Promise<any> {

    try {

      return await this.entityManager.insert('agenti', createAgentiDto);

    } catch (error) {

      console.error('Error al crear el agente:', error);

      throw new Error('No se pudo crear el agente');

    }


  }



  async getAgenti(
    search: AgentiSearch = {},
    page: number = 1,
    limit: number = 20,
    sort: string = 'id',
    order: 'ASC' | 'DESC' = 'ASC'
  ): Promise<{ agenti: any[], total: number }> {
    page = Math.max(1, Number(page));
    limit = Math.max(1, Math.min(50, Number(limit)));
    const validOrder = ['ASC', 'DESC'].includes(order) ? order : 'ASC';
    const sortColumn = AgentiSearchKeys.includes(sort) ? sort : 'id';

    const query = this.entityManager.createQueryBuilder()
      .select('ag.*, co.citta as comuni, co.provincia as prov')
      .from('agenti', 'ag')
      .innerJoin('comuni', 'co', 'ag.comune = co.id');

    this.applyFilters(query, search);

    // Obtener el total de registros
    const totalQueryBuilder = query.clone();
    const totalResult = await totalQueryBuilder.select('COUNT(*)', 'total').getRawOne();
    const total = Number(totalResult?.total) || 0;

    // Aplicar ordenación y paginación
    query
      .orderBy(`ag.${sortColumn}`, validOrder as 'ASC' | 'DESC')
      .offset((page - 1) * limit)
      .limit(limit);

    const agenti = await query.getRawMany();

    return { agenti, total };
  }





  async findOne(id: number) {

    const query = this.entityManager.createQueryBuilder()
      .select('ag.*')
      .from('agenti', 'ag')
      .where('ag.id = :id', { id })

    const agenti = await query.getRawOne()

    if (!agenti) {
      throw new NotFoundException(`Agenti with ID ${id} not found`);
    }

    return agenti;
  }

  async update(id: number, updateAgentiDto: any): Promise<any> {

    try {

      const result = await this.dataSource
        .createQueryBuilder()
        .update('agenti')
        .set(updateAgentiDto)
        .where("id = :id", { id })
        .execute();

      if (result.affected === 0) {

        throw new NotFoundException(`Cliente with ID ${id} not found`);

      }

      return { message: `Cliente with ID ${id} has been updated successfully` };

    } catch (error) {

      console.error('Error al actualizar el clienti::: ', error)

      if (error instanceof NotFoundException) {

        throw error

      }

      throw new Error('No se pudo actualizar el clienti');

    }

  }

  async remove(id: number) {

    const result = await this.dataSource
      .createQueryBuilder()
      .update('agenti')
      .set({ stato: 1 })
      .where("id = :id", { id })
      .execute();

    if (result.affected === 0) {

      throw new NotFoundException(`Officine with ID ${id} not found`)

    }

    return `Delete complete`;

  }

  applyFilters(query: SelectQueryBuilder<any>, search: AgentiSearch): void {
    // Lista de campos válidos para filtrar (excluyendo page y limit)
    const validFields = Object.keys(search).filter(key => !['page', 'limit', 'sort', 'order'].includes(key));

    validFields.forEach(key => {
      const value = search[key];
      if (value !== undefined && value !== null && value !== '') {
        if (typeof value === 'string') {
          query.andWhere(`ag.${key} LIKE :${key}`, { [key]: `%${value}%` });
        } else if (typeof value === 'number') {
          query.andWhere(`ag.${key} = :${key}`, { [key]: value });
        }
      }
    });
  }

}
