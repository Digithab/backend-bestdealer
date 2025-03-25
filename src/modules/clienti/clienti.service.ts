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
    sort: string = 'denominazione',
    order: 'ASC' | 'DESC' = 'ASC'
  ): Promise<{ clienti: any[], total: number }> {
    page = Math.max(1, Number(page));
    limit = Math.max(1, Math.min(50, Number(limit)));
    const validOrder = ['ASC', 'DESC'].includes(order) ? order : 'ASC';

    const sortColumn = ClientiSearchKeys.includes(sort) ? sort : 'denominazione';

    const query = this.entityManager.createQueryBuilder()
      .select('ci.*, co.citta as comuni, co.provincia as prov, a.sigla')
      .from('clienti', 'ci')
      .innerJoin('comuni', 'co', 'ci.comune = co.id')
      .innerJoin('agenti', 'a', 'ci.agente = a.id')
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
      .select('ci.*, c.provincia')
      .from('clienti', 'ci')
      .innerJoin('comuni', 'c', 'ci.comune = c.id')
      .where('ci.is_deleted = 0')
      .andWhere('ci.id = :id', { id })

    const clienti = await query.getRawOne();

    if (!clienti) {
      throw new NotFoundException(`Clienti with ID ${id} not found`)
    }

    return clienti

  }

  async update(id: number, updateClientiDto: any): Promise<any> {

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

  type(value: string) {
    switch (value) {
      case 'Fisica':
        return '0'
        break;
      case 'Giuridica':
        return '1'
        break;
      default:
      // code block
    }
  }

  applyFilters(query: SelectQueryBuilder<any>, search: Clienti): void {
    // Lista de campos válidos para filtrar (excluyendo page y limit)

    const validFields = Object.keys(search).filter(key => !['page', 'limit', 'sort', 'order'].includes(key));

    validFields.forEach(key => {
      const value = search[key];
      if (value !== undefined && value !== null && value !== '') {

        if (key === 'tipo_persona' && value !== undefined) {
          query.andWhere(`ci.tipo_persona = :${key}`, { [key]: this.type(value) });
        }

        if (key === 'sigla' && value !== undefined) {
          query.andWhere(`a.sigla = :${key}`, { [key]: value });
        }

        if (key === 'comune' && value !== undefined) {
          query.andWhere(`co.citta = :${key}`, { [key]: value });
        }

        if (typeof value === 'string' && key !== 'tipo_persona' && key !== 'sigla' && key !== 'comune') {
          query.andWhere(`ci.${key} LIKE :${key}`, { [key]: `%${value}%` });
        } else if (typeof value === 'number') {
          query.andWhere(`ci.${key} = :${key}`, { [key]: value });
        }
      }
    });
  }
}
