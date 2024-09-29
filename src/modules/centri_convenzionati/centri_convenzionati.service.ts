import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateCentriConvenzionatiDto } from './dto/create-centri_convenzionati.dto';
import { UpdateCentriConvenzionatiDto } from './dto/update-centri_convenzionati.dto';
import { Officine } from './interface/officine.interface';
import { InjectDataSource, InjectEntityManager } from '@nestjs/typeorm';
import { DataSource, EntityManager, SelectQueryBuilder } from 'typeorm';

export const OfficineSearchKeys = [
  'nome',              // Correspondiente a 'denominazione'
  'contatto',          // Correspondiente a 'agente'
  'tipo_persona',      // No especificado, puedes agregarlo si lo manejas en tu lógica
  'comune',            // Mismo campo
  'cap',               // No especificado en la interfaz, pero puedes agregarlo si lo usas
  'prov',              // No especificado, puedes agregarlo si es relevante
  'frazione',          // Mismo campo
  'indirizzo',         // Mismo campo
  'zona',              // No especificado en la interfaz, pero puedes agregarlo
  'civico',            // Mismo campo
  'cellulare',         // Mismo campo
  'email',             // Mismo campo
  'pec',               // Mismo campo
  'p_iva',             // 'codfisc_piva' puede ser una combinación de 'cod_fisc' y 'p_iva'
  'attivo',            // Equivalente a 'abilitazione_proforma' en cuanto a estado
  'is_deleted'         // Mismo campo
];


@Injectable()
export class CentriConvenzionatiService {

  constructor(

    @InjectEntityManager() private entityManager: EntityManager,

    @InjectDataSource() private dataSource: DataSource

  ) { }

  async create(createCentriConvenzionatiDto: any): Promise<any> {

    try {
      return await this.entityManager.insert('centri_convenzionati', createCentriConvenzionatiDto)

    } catch (error) {

      console.error('Error al crear el office:: ', error);

      throw new Error('No se pudo crear el office');

    }
  }


  async getAgenti(
    search: Officine = {},
    page: number = 1,
    limit: number = 20,
    sort: string = 'id',
    order: 'ASC' | 'DESC' = 'ASC'
  ): Promise<{ officine: any[], total: number }> {
    page = Math.max(1, Number(page));
    limit = Math.max(1, Math.min(50, Number(limit)));
    const validOrder = ['ASC', 'DESC'].includes(order) ? order : 'ASC';

    const sortColumn = OfficineSearchKeys.includes(sort) ? sort : 'id';

    const query = this.entityManager.createQueryBuilder()
      .select('ce.*, co.citta as comuni, co.provincia as prov')
      .from('centri_convenzionati', 'ce')
      .innerJoin('comuni', 'co', 'ce.comune = co.id')
      .where('ce.is_deleted = 0')

    this.applyFilters(query, search);

    // Obtener el total de registros
    const totalQueryBuilder = query.clone();
    const totalResult = await totalQueryBuilder.select('COUNT(*)', 'total').getRawOne();
    const total = Number(totalResult?.total) || 0;

    // Aplicar ordenación y paginación
    query
      .orderBy(`ce.${sortColumn}`, validOrder as 'ASC' | 'DESC')
      .offset((page - 1) * limit)
      .limit(limit);

    const officine = await query.getRawMany();

    return { officine, total };
  }

  async findOne(id: number) {

    const query = this.entityManager.createQueryBuilder()
      .select('ce.*')
      .from('centri_convenzionati', 'ce')
      .where('ce.is_deleted = 0')
      .andWhere('ce.id = :id', { id })

    const Officine = await query.getRawOne();

    if (!Officine) {
      throw new NotFoundException(`Clienti with ID ${id} not found`)
    }

    return Officine
  }

  async update(id: number, updateCentriConvenzionatiDto: any): Promise<any> {

    const result = await this.dataSource
      .createQueryBuilder()
      .update('centri_convenzionati')
      .set(updateCentriConvenzionatiDto)
      .where("id = :id", { id })
      .execute();

    if (result.affected === 0) {

      throw new NotFoundException(`Agenti with ID ${id} not found`)

    }

    return { message: `Officine with ID ${id} has been updated successfully` };
  }

  async remove(id: number) {

    const result = await this.dataSource
      .createQueryBuilder()
      .update('centri_convenzionati')
      .set({ is_deleted: 1 })
      .where("id = :id", { id })
      .execute();

    if (result.affected === 0) {

      throw new NotFoundException(`Officine with ID ${id} not found`)

    }

    return `Delete complete`;

  }

  applyFilters(query: SelectQueryBuilder<any>, search: Officine): void {
    // Lista de campos válidos para filtrar (excluyendo page y limit)

    const validFields = Object.keys(search).filter(key => !['page', 'limit', 'sort', 'order'].includes(key));

    validFields.forEach(key => {
      const value = search[key];
      if (value !== undefined && value !== null && value !== '') {
        if (typeof value === 'string') {
          query.andWhere(`ce.${key} LIKE :${key}`, { [key]: `%${value}%` });
        } else if (typeof value === 'number') {
          query.andWhere(`ce.${key} = :${key}`, { [key]: value });
        }
      }
    });
  }
}
