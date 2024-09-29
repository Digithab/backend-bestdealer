import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateFornitoriDto } from './dto/create-fornitori.dto';
import { UpdateFornitoriDto } from './dto/update-fornitori.dto';
import { InjectDataSource, InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager, DataSource, SelectQueryBuilder } from 'typeorm';
import { Fornitori } from './interface/fornitori.interface';

export const FornitoriSearchKeys = [
  'tipo_persona',    // booleano | string (en la interfaz)
  'denominazione',   // string, máximo 50 caracteres
  'tipo_fornitore',  // keyof typeof self.$tipiFornitori (no aparece aquí, pero podría ser necesario)
  'comune',          // número
  'cap',             // string, máximo 5 caracteres
  'indirizzo',       // string, máximo 75 caracteres
  'email',           // string, debe ser un email válido
  'pec',             // string, debe ser un email válido
  'cod_univoco',     // string, máximo 7 caracteres
  'codfisc_piva',    // string, máximo 16 caracteres
  'is_deleted',      // booleano
]

@Injectable()
export class FornitoriService {

  constructor(

    @InjectEntityManager() private entityManager: EntityManager,

    @InjectDataSource() private dataSource: DataSource

  ) { }
  async create(createFornitoriDto: CreateFornitoriDto): Promise<any> {
    try {

      return await this.entityManager.insert('fornitori', createFornitoriDto)

    } catch (error) {

      console.error('Error al crear el clienti:: ', error);

      throw new Error('No se pudo crear el clienti');
    }
  }

  async getFornitori(
    search: Fornitori = {},
    page: number = 1,
    limit: number = 20,
    sort: string = 'id',
    order: 'ASC' | 'DESC' = 'ASC'
  ): Promise<{ fornitori: any[], total: number }> {

    page = Math.max(1, Number(page));

    limit = Math.max(1, Math.min(50, Number(limit)));

    console.log(page)
    console.log(limit)

    const validOrder = ['ASC', 'DESC'].includes(order) ? order : 'ASC';

    const sortColumn = FornitoriSearchKeys.includes(sort) ? sort : 'id';

    const query = this.entityManager.createQueryBuilder()
      .select('f.*, co.citta as comuni, co.provincia as prov')
      .from('fornitori', 'f')
      .innerJoin('comuni', 'co', 'f.comune = co.id')
      .where('f.is_deleted = 0')

    this.applyFilters(query, search);

    // Obtener el total de registros
    const totalQueryBuilder = query.clone();
    const totalResult = await totalQueryBuilder.select('COUNT(*)', 'total').getRawOne();
    const total = Number(totalResult?.total) || 0;

    // Aplicar ordenación y paginación
    query
      .orderBy(`f.${sortColumn}`, validOrder as 'ASC' | 'DESC')
      .offset((page - 1) * limit)
      .limit(limit);

    const fornitori = await query.getRawMany();

    return { fornitori, total };
  }

  async findOne(id: number) {
    const query = this.entityManager.createQueryBuilder()
      .select('f.*')
      .from('fornitori', 'f')
      .where('f.is_deleted = 0')
      .andWhere('f.id = :id', { id })

    const data = await query.getRawOne();

    if (!data) {
      throw new NotFoundException(`Fornitori with ID ${id} not found`)
    }

    return data
  }

  async update(id: number, updateFornitoriDto: UpdateFornitoriDto): Promise<any> {
    try {

      const result = await this.dataSource
        .createQueryBuilder()
        .update('fornitori')
        .set(updateFornitoriDto)
        .where("id = :id", { id })
        .execute();

      if (result.affected === 0) {

        throw new NotFoundException(`Fornitori with ID ${id} not found`)

      }

      return { message: `Fornitori with ID ${id} has been updated successfully` };

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
      .update('fornitori')
      .set({ is_deleted: 1 })
      .where("id = :id", { id })
      .execute();

    if (result.affected === 0) {

      throw new NotFoundException(`Officine with ID ${id} not found`)

    }

    return `Delete complete`;
  }

  applyFilters(query: SelectQueryBuilder<any>, search: Fornitori): void {
    // Lista de campos válidos para filtrar (excluyendo page y limit)    
    const validFields = Object.keys(search).filter(key => !['page', 'limit', 'sort', 'order'].includes(key));

    validFields.forEach(key => {
      const value = search[key];
      if (value !== undefined && value !== null && value !== '') {
        if (typeof value === 'string') {
          query.andWhere(`f.${key} LIKE :${key}`, { [key]: `%${value}%` });
        } else if (typeof value === 'number') {
          query.andWhere(`f.${key} = :${key}`, { [key]: value });
        }
      }
    });
  }
}

