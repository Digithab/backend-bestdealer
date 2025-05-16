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
      const { tipi, ...newValue } = createCentriConvenzionatiDto
      const result = await this.entityManager.insert('centri_convenzionati', newValue)

      for (let tp of tipi) {

        const data = {
          centro: result.raw?.insertId,
          tipo: tp,
          attivo: 1
        }
        await this.entityManager.insert('centri_convenzionati__assoc__tipi', data);
      }
      console.log('Proceso realizado')

    } catch (error) {

      console.error('Error al crear el office:: ', error);

      throw new Error('No se pudo crear el office');

    }
  }


  async getOffina(
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
      .andWhere('ce.id = :id', { id });

    const tipiQuery = this.entityManager.createQueryBuilder()
      .select('ccat.tipo')
      .from('centri_convenzionati__assoc__tipi', 'ccat')
      .where('ccat.centro = :id', { id })
      .andWhere('ccat.attivo = 1')

    const [Officine, tipi] = await Promise.all([
      query.getRawOne(),
      tipiQuery.getRawMany()
    ]);

    if (!Officine) {
      throw new NotFoundException(`Clienti with ID ${id} not found`);
    }

    return {
      ...Officine,
      tipi: tipi.map(t => t.tipo)
    };
  }

  async getOfficina() {
    const query = this.entityManager.createQueryBuilder()
      .select('DISTINCT c.regione')
      .from('comuni', 'c')
      .leftJoin('centri_convenzionati', 'ce', 'ce.comune = c.id')
      .orderBy('c.regione', 'ASC')


    const regioni = await query.getRawMany();
    console.log('regioni___ ', regioni);
    return regioni;
  }

  async dataOfficina() {
    // 1. Obtener todas las regiones con centros activos en una sola consulta
    const regionsQuery = `
        SELECT DISTINCT c.regione
        FROM comuni c
        INNER JOIN centri_convenzionati ce ON ce.comune = c.id
        WHERE ce.is_deleted = 0
        ORDER BY c.regione ASC
    `;

    const centersQuery = `
        SELECT 
            ce.id,
            ce.nome,
            ce.indirizzo,
            ce.cap,
            ce.telefono,
            ce.email,
            co.citta,
            co.provincia,
            ce.commento,
            co.regione
        FROM centri_convenzionati ce
        LEFT JOIN comuni co ON ce.comune = co.id
        WHERE ce.is_deleted = 0
        ORDER BY co.regione ASC, co.provincia ASC
    `;

    // 2. Ejecutar ambas queries en paralelo
    const [regions, centers] = await Promise.all([
      this.dataSource.query(regionsQuery),
      this.dataSource.query(centersQuery)
    ]);

    // 3. Obtener todos los tipos para todos los centros en una sola consulta
    const typesQuery = `
        SELECT 
            ccat.centro as centerId,
            cct.descrizione
        FROM centri_convenzionati__tipi cct
        INNER JOIN centri_convenzionati__assoc__tipi ccat ON cct.id = ccat.tipo
        WHERE ccat.attivo = 1 AND ccat.centro IN (?)
    `;
    const centerIds = centers.map(center => center.id);
    const types = await this.dataSource.query(typesQuery, [centerIds]);

    // 4. Crear mapa de tipos por centro
    const typesByCenter = types.reduce((acc, type) => {
      if (!acc[type.centerId]) {
        acc[type.centerId] = [];
      }
      acc[type.centerId].push(type.descrizione);
      return acc;
    }, {});

    // 5. Organizar los resultados por región
    const centersByRegion = centers.reduce((acc, center) => {
      if (!acc[center.regione]) {
        acc[center.regione] = [];
      }
      center.tipo = typesByCenter[center.id] || [];
      acc[center.regione].push(center);
      return acc;
    }, {});

    // 6. Formatear el resultado final
    return regions.map(({ regione }) => ({
      regione,
      count: centersByRegion[regione]?.length || 0,
      data: centersByRegion[regione] || []
    }));
  }



  async update(id: number, updateCentriConvenzionatiDto: any): Promise<any> {

    const { tipi, commento, ...updateCentriConvenzionati } = updateCentriConvenzionatiDto
    console.log('updateCentriConvenzionati___ ', updateCentriConvenzionati);
    console.log('id____', id)
    const result = await this.dataSource
      .createQueryBuilder()
      .update('centri_convenzionati')
      .set(updateCentriConvenzionati)
      .where('id = :id', { id })
      .execute();

    await this.dataSource
      .createQueryBuilder()
      .update('centri_convenzionati__assoc__tipi')
      .set({ attivo: 0 })
      .where("centro = :centro", { centro: id })
      .execute();

    for (let tp of tipi) {

      const data = {
        centro: id,
        tipo: tp,
        attivo: 1
      }
      await this.entityManager.insert('centri_convenzionati__assoc__tipi', data);
    }

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
        console.log('value: ', value)
        console.log('key: ', key)
        if (key === 'comuni' && value !== undefined) {
          query.andWhere(`co.citta LIKE :${key}`, { [key]: `%${value}%` });
        }

        if (key === 'prov') {
          query.andWhere(`co.provincia LIKE :${key}`, { [key]: `%${value}%` });
        }

        if (typeof value === 'string' && key !== 'comuni' && key !== 'prov') {
          query.andWhere(`ce.${key} LIKE :${key}`, { [key]: `%${value}%` });
        } else if (typeof value === 'number') {
          query.andWhere(`ce.${key} = :${key}`, { [key]: value });
        }
      }
    });
  }
}
