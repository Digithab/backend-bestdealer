import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateSoccorsiStradaliDto } from './dto/create-soccorsi-stradali.dto';
import { UpdateSoccorsiStradaliDto } from './dto/update-soccorsi-stradali.dto';
import { Stradali } from './interface/stradali.interface';
import { DataSource, EntityManager, SelectQueryBuilder } from 'typeorm';
import { InjectDataSource, InjectEntityManager } from '@nestjs/typeorm';
import { format } from 'date-fns';

export const StradaliSearchKeys = [
  'id',
  'indirizzo_fermo',
  'indirizzo_dest',
  'data_fermo',
  'km_fermo',
  'note',
  'garanzia',
  'is_cs',
  'spie_accese',
  'causa_fermo',
  'targa',
  'proprietario'
]

interface SearchParams {
  targa: string | null;
  garanzia: number | null;
  proprietario: string | null;
}

@Injectable()
export class SoccorsiStradaliService {

  constructor(
    @InjectEntityManager() private entityManager: EntityManager,

    @InjectDataSource() private dataSource: DataSource
  ) { }
  async create(createSoccorsiStradaliDto: any, userId?: string) {
    try {
      const { SpiaTemperatura, SpiaOlio, SpiaAltro, ...newDto } = createSoccorsiStradaliDto
      newDto.spie_accese = `${SpiaTemperatura}${SpiaOlio}${SpiaAltro}`
      newDto.data_fermo = format(newDto.data_fermo, 'yyyy-MM-dd HH:mm:ss');
      const pf_found = await this.dataSource
        .createQueryBuilder()
        .insert()
        .into('soccorsi')
        .values(
          newDto
        )
        .execute();

      return pf_found
    } catch (error) {
      console.log('error___ ', error)
    }

  }

  async getStradali(
    search: Stradali = {},
    page: number = 1,
    limit: number = 20,
    sort: string = 'id',
    order: 'DESC' | 'ASC' = 'DESC'
  ): Promise<{ stradali: any[], total: number }> {
    page = Math.max(1, Number(page));
    limit = Math.max(1, Math.min(50, Number(limit)));
    const validOrder = ['DESC', 'ASC'].includes(order) ? order : 'ASC';

    const sortColumn = StradaliSearchKeys.includes(sort) ? sort : 'id';

    const query = this.entityManager
      .createQueryBuilder()
      .select('soc.*')
      .from('v_stradali', 'soc');

    this.applyFilters(query, search);

    // Obtener el total de registros
    const totalQueryBuilder = query.clone();
    const totalResult = await totalQueryBuilder.select('COUNT(*)', 'total').getRawOne();
    const total = Number(totalResult?.total) || 0;

    // Aplicar ordenación y paginación
    query
      .orderBy(`soc.${sortColumn}`, validOrder as 'ASC' | 'DESC')
      .offset((page - 1) * limit)
      .limit(limit);

    const stradali = await query.getRawMany();

    return { stradali, total };
  }

  findOne(id: number) {
    return `This action returns a #${id} soccorsiStradali`;
  }

  update(id: number, updateSoccorsiStradaliDto: UpdateSoccorsiStradaliDto) {
    return `This action updates a #${id} soccorsiStradali`;
  }


  applyFilters(query: SelectQueryBuilder<any>, search: Stradali): void {
    // Lista de campos válidos para filtrar (excluyendo page y limit)

    const validFields = Object.keys(search).filter(key => !['page', 'limit', 'sort', 'order'].includes(key));

    validFields.forEach(key => {
      const value = search[key];
      if (value !== undefined && value !== null && value !== '') {
        if (typeof value === 'string') {
          query.andWhere(`soc.${key} LIKE :${key}`, { [key]: `%${value}%` });
        } else if (typeof value === 'number') {
          query.andWhere(`soc.${key} = :${key}`, { [key]: value });
        }
      }
    });
  }

  private async searchGaranzie(params: SearchParams) {
    const query = this.entityManager
      .createQueryBuilder()
      .select([
        'clienti.denominazione',
        'clienti.tipo_persona',
        'veicoli.targa',
        '(garanzie.id + 15000) AS garanzie',
        'garanzie.soccorso__km AS km',
        'data_inserimento',
        'data_attivazione',
        'data_scadenza',
        '0 AS is_cs'
      ])
      .from('garanzie', 'garanzie')
      .innerJoin('veicoli', 'veicoli', 'garanzie.veicolo = veicoli.id')
      .innerJoin('clienti', 'clienti', 'garanzie.proprietario = clienti.id')
      .where('garanzie.is_deleted = :isDeleted', { isDeleted: false });

    if (params.targa) {
      query.andWhere('veicoli.targa = :targa', { targa: params.targa });
    }

    if (params.garanzia) {
      query.andWhere('(garanzie.id + 15000) = :garanzia', {
        garanzia: params.garanzia
      });
    }

    if (params.proprietario) {
      query.andWhere('CONCAT(clienti.denominazione) LIKE :proprietario', {
        proprietario: `%${params.proprietario}%`
      });
    }

    return query.limit(5).getRawMany();
  }

  private parseSearchParams(search: any): SearchParams {
    return {
      targa: search.targa !== '' ? search.targa : null,
      garanzia: search.garanzia !== '' ? parseInt(search.garanzia, 10) : null,
      proprietario: search.proprietario !== '' ? search.proprietario : null,
    };
  }

  private async searchCardss(params: SearchParams) {
    const query = this.entityManager
      .createQueryBuilder()
      .select([
        'clienti.denominazione',
        'clienti.tipo_persona',
        'veicoli.targa',
        '(card_soccorso.id + 3000) AS garanzie',
        'card_soccorso.tipo_card AS km',
        'data_inserimento',
        'data_attivazione',
        'data_scadenza',
        '1 AS is_cs'
      ])
      .from('card_soccorso_2', 'card_soccorso')
      .innerJoin('veicoli', 'veicoli', 'card_soccorso.veicolo = veicoli.id')
      .innerJoin('clienti', 'clienti', 'card_soccorso.proprietario = clienti.id')
      .where('card_soccorso.is_deleted = :isDeleted', { isDeleted: false });

    if (params.targa) {
      query.andWhere('veicoli.targa = :targa', { targa: params.targa });
    }

    if (params.garanzia) {
      query.andWhere('(card_soccorso.id + 3000) = :garanzia', {
        garanzia: params.garanzia
      });
    }

    if (params.proprietario) {
      query.andWhere('CONCAT(clienti.denominazione) LIKE :proprietario', {
        proprietario: `%${params.proprietario}%`
      });
    }

    return query.limit(5).getRawMany();
  }

  async search(searchData: any) {
    const params = this.parseSearchParams(searchData);

    const [garanzie, cardss] = await Promise.all([
      this.searchGaranzie(params),
      this.searchCardss(params)
    ]);

    return [...garanzie, ...cardss];
  }
}
