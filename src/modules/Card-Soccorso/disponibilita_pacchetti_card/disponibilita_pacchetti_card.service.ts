import { Injectable } from '@nestjs/common';
import { CreateDisponibilitaPacchettiCardDto } from './dto/create-disponibilita_pacchetti_card.dto';
import { UpdateDisponibilitaPacchettiCardDto } from './dto/update-disponibilita_pacchetti_card.dto';
import { DataSource, EntityManager, SelectQueryBuilder } from 'typeorm';
import { InjectDataSource, InjectEntityManager } from '@nestjs/typeorm';

export const CardSearchKeys = [
  'dealer',
  'nome_dealer',
  'sigla',
  'nome_agente',
  'cnt',
  'card_40 ',
  'card_60',
  'card_100',
  'nazionali',
  'regionali'
]

@Injectable()
export class DisponibilitaPacchettiCardService {

  constructor(

    @InjectEntityManager() private entityManager: EntityManager,

    @InjectDataSource() private dataSource: DataSource
  ) { }

  create(createDisponibilitaPacchettiCardDto: CreateDisponibilitaPacchettiCardDto) {
    return 'This action adds a new disponibilitaPacchettiCard';
  }

  async findTotalAcquistate(dealer: any, tipoSoccorso: any) {
    return await this.dataSource.transaction(async (manager) => {
      const queryTotAcquistate = await manager.createQueryBuilder()
        .select('MIN(ordiniPacchetti.data_attivazione)', 'attivazione')
        .addSelect('SUM(ordiniPacchettiQuantita.quantita + ordiniPacchettiQuantita.omaggio)', 'tot')
        .from('ordini__pacchetti_cardss', 'ordiniPacchetti')
        .innerJoin('ordini__pacchetti_cardss_quantita', 'ordiniPacchettiQuantita', 'ordiniPacchettiQuantita.ordine = ordiniPacchetti.id')
        .where('ordiniPacchetti.dealer = :dealer', { dealer })
        .andWhere('ordiniPacchetti.is_deleted = :is_deleted', { is_deleted: false })
        .andWhere('ordiniPacchetti.is_imported = :is_imported', { is_imported: false })
        .andWhere('ordiniPacchettiQuantita.soccorso = :tipoSoccorso', { tipoSoccorso })
        .andWhere('ordiniPacchettiQuantita.is_deleted = :is_deleted', { is_deleted: false })
        .andWhere('CURRENT_DATE BETWEEN ordiniPacchetti.data_attivazione AND ordiniPacchetti.data_scadenza')
        .groupBy('ordiniPacchettiQuantita.soccorso')
        .getRawOne();

      if (!queryTotAcquistate) return 0;
      let queryTotUtilizzate: any
      console.log('queryTotAcquistate.attivazione__ ', queryTotAcquistate.attivazione)
      queryTotUtilizzate = await this.dataSource.createQueryBuilder()
        .select('COUNT(*)')
        .from('card_soccorso_2', 'cs')
        .where('cs.id_proforma = :id_proforma', { id_proforma: 0 })
        .andWhere('cs.dealer = :dealer', { dealer: dealer })
        .andWhere('cs.is_deleted = :is_deleted', { is_deleted: false })
        .andWhere('cs.is_imported = :is_imported', { is_imported: false })
        .andWhere('cs.data_attivazione >= :data_attivazione', {
          data_attivazione: queryTotAcquistate.attivazione
        });


      switch (tipoSoccorso) {
        case 'RR':
          queryTotUtilizzate.andWhere('cs.restituzione = :restituzione', { restituzione: 1 });
          break;
        case 'RN':
          queryTotUtilizzate.andWhere('cs.restituzione = :restituzione', { restituzione: 2 });
          break;
        default:
          queryTotUtilizzate.andWhere('cs.tipo_card = :tipo_card', { tipo_card: tipoSoccorso });
          break;
      }

      const totUtilizzate = await queryTotUtilizzate.getRawOne();
      return Math.max(queryTotAcquistate.tot || 0 - totUtilizzate, 0);
    });
  }

  async getAllDisponibiitaCard(
    search: AgentiSearch = {},
    page: number = 1,
    limit: number = 20,
    sort: string = 'id',
    order: 'ASC' | 'DESC' = 'ASC'
  ): Promise<{ card: any[], total: number }> {
    page = Math.max(1, Number(page));
    limit = Math.max(1, Math.min(50, Number(limit)));
    const validOrder = ['ASC', 'DESC'].includes(order) ? order : 'ASC';
    const sortColumn = CardSearchKeys.includes(sort) ? sort : 'dealer';

    const query = this.entityManager.createQueryBuilder()
      .select('ag.*')
      .from('v_card_disponibilita', 'ag')

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

    console.log('search', search)

    const card = await query.getRawMany();

    return { card, total };
  }


  findAll() {
    return `This action returns all disponibilitaPacchettiCard`;
  }

  findOne(id: number) {
    return `This action returns a #${id} disponibilitaPacchettiCard`;
  }

  update(id: number, updateDisponibilitaPacchettiCardDto: UpdateDisponibilitaPacchettiCardDto) {
    return `This action updates a #${id} disponibilitaPacchettiCard`;
  }

  remove(id: number) {
    return `This action removes a #${id} disponibilitaPacchettiCard`;
  }

  applyFilters(query: SelectQueryBuilder<any>, search: CardSearch): void {
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
