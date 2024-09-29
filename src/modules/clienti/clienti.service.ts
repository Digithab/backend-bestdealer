import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateClientiDto } from './dto/create-clienti.dto';
import { UpdateClientiDto } from './dto/update-clienti.dto';
import { InjectDataSource, InjectEntityManager } from '@nestjs/typeorm';
import { DataSource, EntityManager, SelectQueryBuilder } from 'typeorm';
import { Clienti } from './interface/clienti.interface';

export const ClientiSearchKeys = [
  'denominazione',
  'agente',
  'tipo_persona',
  'comune',
  'cap',
  'prov',
  'frazione',
  'indirizzo',
  'zona',
  'civico',
  'cellulare',
  'email',
  'pec',
  'cod_univoco',
  'codfisc_piva',
  'abilitazione_proforma',
  'is_deleted'
]

@Injectable()
export class ClientiService {

  constructor(

    @InjectEntityManager() private entityManager: EntityManager,

    @InjectDataSource() private dataSource: DataSource


  ) { }
  async create(createClientiDto: any): Promise<any> {

    try {

      return await this.entityManager.insert('clienti', createClientiDto)

    } catch (error) {

      console.error('Error al crear el clienti:: ', error);

      throw new Error('No se pudo crear el clienti');
    }
  }

  async getAgenti(
    search: Clienti = {},
    page: number = 1,
    limit: number = 20,
    sort: string = 'id',
    order: 'ASC' | 'DESC' = 'ASC'
  ): Promise<{ clienti: any[], total: number }> {
    page = Math.max(1, Number(page));
    limit = Math.max(1, Math.min(50, Number(limit)));
    const validOrder = ['ASC', 'DESC'].includes(order) ? order : 'ASC';

    const sortColumn = ClientiSearchKeys.includes(sort) ? sort : 'id';

    const query = this.entityManager.createQueryBuilder()
      .select('ci.*, co.citta as comuni, co.provincia as prov')
      .from('clienti', 'ci')
      .innerJoin('comuni', 'co', 'ci.comune = co.id')
      .where('ci.is_deleted = 0')
      .andWhere('ci.abilitazione_proforma = 1');

    this.applyFilters(query, search);

    // Obtener el total de registros
    const totalQueryBuilder = query.clone();
    const totalResult = await totalQueryBuilder.select('COUNT(*)', 'total').getRawOne();
    const total = Number(totalResult?.total) || 0;

    // Aplicar ordenación y paginación
    query
      .orderBy(`ci.${sortColumn}`, validOrder as 'ASC' | 'DESC')
      .offset((page - 1) * limit)
      .limit(limit);

    const clienti = await query.getRawMany();

    return { clienti, total };
  }

  async findOne(id: number) {

    const query = this.entityManager.createQueryBuilder()
      .select('ci.*')
      .from('clienti', 'ci')
      .where('ci.is_deleted = 0')
      .andWhere('ci.id = :id', { id })

    const clienti = await query.getRawOne();

    if (!clienti) {
      throw new NotFoundException(`Clienti with ID ${id} not found`)
    }

    return clienti

  }

  async update(id: number, updateClientiDto: UpdateClientiDto): Promise<any> {

    try {

      const result = await await this.dataSource
        .createQueryBuilder()
        .update('clienti')
        .set(updateClientiDto)
        .where("id = :id", { id })
        .execute();

      if (result.affected === 0) {

        throw new NotFoundException(`Agenti with ID ${id} not found`)

      }

      return { message: `Agenti with ID ${id} has been updated successfully` };

    } catch (error) {

      console.error('Error al actualizar el agenti:: ', error)

      if (error instanceof NotFoundException) {

        throw error

      }

      throw new Error('No se pudo actualizar el agenti')

    }
  }

  async remove(id: number) {

    const result = await this.dataSource
      .createQueryBuilder()
      .update('clienti')
      .set({ is_deleted: 1 })
      .where("id = :id", { id })
      .execute();

    if (result.affected === 0) {

      throw new NotFoundException(`Officine with ID ${id} not found`)

    }

    return `Delete complete`;
  }

  applyFilters(query: SelectQueryBuilder<any>, search: Clienti): void {
    // Lista de campos válidos para filtrar (excluyendo page y limit)

    const validFields = Object.keys(search).filter(key => !['page', 'limit', 'sort', 'order'].includes(key));

    validFields.forEach(key => {
      const value = search[key];
      if (value !== undefined && value !== null && value !== '') {
        if (typeof value === 'string') {
          query.andWhere(`ci.${key} LIKE :${key}`, { [key]: `%${value}%` });
        } else if (typeof value === 'number') {
          query.andWhere(`ci.${key} = :${key}`, { [key]: value });
        }
      }
    });
  }
}
