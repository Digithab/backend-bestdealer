import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateOrdiniPachettiCardDto } from './dto/create-ordini_pachetti_card.dto';
import { UpdateOrdiniPachettiCardDto } from './dto/update-ordini_pachetti_card.dto';
import { InjectDataSource, InjectEntityManager } from '@nestjs/typeorm';
import { DataSource, EntityManager, SelectQueryBuilder } from 'typeorm';
import { UsersService } from 'src/modules/users/users.service';
import { LogService } from 'src/modules/operation/log/log.service';
import { ProformaService } from 'src/modules/Fatture/proforma/proforma.service';
import { User } from 'src/interfaces/interfaces';
import { OrdiniSearch } from './interface/ordini_pachetti_cards.interface';
import { endOfMonth, format } from 'date-fns';

export const OrdiniSearchKeys = [
  'id',
  'denominazione',
  'sigla',
  ',data_inserimento',
  ',data_attivazione',
  ',data_scadenza'
]

interface CardItem {
  quantita: number;
  prezzo: number;
  netto: number;
  totale: number;
  omaggio?: number;
  ordine?: number;
  id?: number;
}

@Injectable()
export class OrdiniPachettiCardsService {

  constructor(

    @InjectEntityManager() private entityManager: EntityManager,

    @InjectDataSource() private dataSource: DataSource,

    private usersService: UsersService,

    private logService: LogService,

    private proformaService: ProformaService

  ) { }

  async create(createOrdiniPachettiCardDto: any, userId: any) {
    return await this.dataSource.transaction(async (manager) => {
      const user = await this.validateUser(userId);

      if (user.role !== 'admin') return

      const model = createOrdiniPachettiCardDto;
      model.data_inserimento = new Date();
      model.id_proforma = 0;
      model.is_deleted = false;

      console.log('model___ ', model)
      let importo_tot = 0;

      const { cardData, ...filteredModel } = model;

      console.log('filteredModel___ ', filteredModel)
      const is_saved = await manager
        .createQueryBuilder()
        .insert()
        .into('ordini__pacchetti_cardss')
        .values(
          filteredModel
        )
        .execute();
      await manager.query('COMMIT');

      const filteredCardData = Object.entries(model.cardData)
        .filter(([_, item]) => (item as CardItem).quantita > 0)
        .map(([key, item]) => ({
          soccorso: key,
          prezzo: (item as CardItem).prezzo,
          quantita: (item as CardItem).quantita,
          prezzo_netto: (item as CardItem).netto,
          totale: (item as CardItem).totale,
          ordine: is_saved.raw?.insertId,
          omaggio: (item as CardItem).omaggio || 0,
        }));

      console.log('Provaaa______: ', filteredCardData)

      // if (is_saved) {
      let index = 0
      for (let card of filteredCardData) {
        console.log('card____: ', card)

        const { totale, prezzo, ...filteredData } = card;

        const is_sav = await manager
          .createQueryBuilder()
          .insert()
          .into('ordini__pacchetti_cardss_quantita')
          .values(
            filteredData
          )
          .execute();

        importo_tot += card.totale
      }
      console.log('importo_tot___ ', importo_tot)

      const [info_dealer] = await manager.query('SELECT * FROM dealers WHERE id = ?', [model.dealer])

      const formattedDate = model.pagamento__data
        ? format(endOfMonth(new Date()), 'yyyy-MM-dd')  // Último día del mes
        : format(new Date(), 'yyyy-MM-dd');

      const proforma = {
        'tipo_cliente': 0,
        'id_cliente': info_dealer.id,
        'agente': info_dealer.agente,
        'tipo_proforma': 3,
        'importo': importo_tot.toFixed(2),
        'data_inserimento': new Date(),
        'data_proforma': formattedDate,
        'data_invio': '1900-01-01',
        'pagamento__rate': model.rate,
        'pagamento__differita': model.prima_rata,
        'pagamento__periodo': model.periodo,
        'is_deleted': false
      }

      const pf_found = await manager
        .createQueryBuilder()
        .insert()
        .into('proforma')
        .values(
          proforma
        )
        .execute();

      model.id_proforma = pf_found.raw?.insertId

      await manager
        .createQueryBuilder()
        .update('ordini__pacchetti_cardss')
        .set({ id_proforma: pf_found.raw?.insertId })
        .where('id = :id', { id: is_saved.raw?.insertId })
        .execute();


    })

    return { message: 'Proceso realizado correctamente' }
  }

  async getOrdini(
    search: OrdiniSearch = {},
    page: number = 1,
    limit: number = 20,
    sort: string = 'id',
    order: 'DESC' | 'ASC' = 'DESC'
  ): Promise<{
    ordini: any[], total: number
  }> {
    page = Math.max(1, Number(page));
    limit = Math.max(1, Math.min(50, Number(limit)));
    const validOrder = ['ASC', 'DESC'].includes(order) ? order : 'DESC';
    const sortColumn = OrdiniSearchKeys.includes(sort) ? sort : 'id';

    const query = this.entityManager.createQueryBuilder()
      .select('op.id, d.denominazione, a.sigla, op.data_inserimento, op.data_attivazione, op.data_scadenza, CASE WHEN p.id IS NOT NULL AND p.importo > 0 THEN true ELSE false END as has_fatture')
      .from('ordini__pacchetti_cardss', 'op')
      .innerJoin('dealers', 'd', 'op.dealer = d.id')
      .innerJoin('agenti', 'a', 'op.agente = a.id')
      .leftJoin('proforma', 'p', 'p.id = op.id_proforma')
      .where('op.is_deleted = 0');
    this.applyFilters(query, search);


    const totalQueryBuilder = query.clone();
    const totalResult = await totalQueryBuilder.select('COUNT(*)', 'total').getRawOne();
    const total = Number(totalResult?.total) || 0;

    // Aplicar ordenación y paginación
    query
      .orderBy(`op.${sortColumn}`, validOrder as 'DESC' | 'ASC')
      .offset((page - 1) * limit)
      .limit(limit);

    const ordini = await query.getRawMany();
    // Fetch products for each order
    const ordiniWithProducts = await Promise.all(ordini.map(async (ordine) => {
      const products = await this.entityManager
        .createQueryBuilder()
        .select('*')
        .from('ordini__pacchetti_cardss_quantita', 'opq')
        .where('opq.ordine = :ordineId', { ordineId: ordine.id })
        .getRawMany();

      return {
        ...ordine,
        products
      };
    }));

    return { ordini: ordiniWithProducts, total };
  }

  async findOne(id: number) {
    const ordini = await this.entityManager
      .createQueryBuilder()
      .select('*')
      .from('ordini__pacchetti_cardss', 'opc')
      .where('opc.id = :id', { id: id })
      .getRawMany();

    return ordini;
  }

  async ordiniCards(id: number) {
    const ordini = await this.entityManager
      .createQueryBuilder()
      .select('opc.id, opc.soccorso, opc.quantita, opc.prezzo_netto, opc.omaggio')
      .from('ordini__pacchetti_cardss_quantita', 'opc')
      .where('opc.ordine = :ordine', { ordine: id })
      .andWhere('opc.is_deleted = 0')
      .getRawMany();

    console.log('ordini___ ', ordini)
    return ordini;
  }


  async update(id: number, updateOrdiniPachettiCardDto: any, userId: string) {
    return await this.dataSource.transaction(async (manager) => {
      const user = await this.validateUser(userId);

      if (user.role !== 'admin') return
      console.log('id___ ', id)
      const model = updateOrdiniPachettiCardDto
      console.log('model::___', model)

      let importo_tot = 0;
      const { cardData, ...filteredModel } = model;

      const is_update = await this.entityManager
        .createQueryBuilder()
        .update('ordini__pacchetti_cardss')
        .set(filteredModel)
        .where('id = :id', { id })
        .execute();

      const filteredCardData = Object.entries(model.cardData)
        .filter(([_, item]) => (item as CardItem).quantita > 0)
        .map(([key, item]) => ({
          soccorso: key,
          prezzo: (item as CardItem).prezzo,
          quantita: (item as CardItem).quantita,
          prezzo_netto: (item as CardItem).netto,
          totale: (item as CardItem).totale,
          ordine: (item as CardItem).ordine,
          id: (item as CardItem).id,
          omaggio: (item as CardItem).omaggio || 0,
        }));

      for (let card of filteredCardData) {
        const { totale, prezzo, ...filteredCardData } = card
        const { id } = card
        await this.entityManager
          .createQueryBuilder()
          .update('ordini__pacchetti_cardss_quantita')
          .set(filteredCardData)
          .where('id = :id', { id })
          .execute();

      }

      const [has] = await manager.query('SELECT * FROM proforma WHERE id = ? AND is_deleted = 0', [model.id_proforma])
      const has_fatture = has ? true : false
      if (has_fatture) {
        await this.proformaService.recalcTotaleProforma(model.id_proforma)
        await this.proformaService.genPdfProforma(model.id_proforma)
      }
    })
  }

  async remove(id: number) {

    const result = await this.dataSource
      .createQueryBuilder()
      .update('ordini__pacchetti')
      .set({ is_deleted: 1 })
      .where("id = :id", { id })
      .execute();

    if (result.affected === 0) {
      throw new NotFoundException(`Ordini with ID ${id} not found`)
    }

    return `Delete complete`;

  }

  applyFilters(query: SelectQueryBuilder<any>, search: OrdiniSearch): void {
    // Lista de campos válidos para filtrar (excluyendo page y limit)
    // const validFields = Object.keys(search).filter(key => !['page', 'limit', 'sort', 'order'].includes(key));
    const fieldMappings = {
      denominazione: 'd',    // campo de la tabla dealers
      sigla: 'a',           // campo de la tabla agenti
      // campos de la tabla ordini__pacchetti_cardss
      data_inserimento: 'op',
      data_attivazione: 'op',
      data_scadenza: 'op',
      // Agrega más campos según necesites
    };

    const validFields = Object.keys(search).filter(key =>
      !['page', 'limit', 'sort', 'order'].includes(key));
    // validFields.forEach(key => {
    //   const value = search[key];
    //   if (value !== undefined && value !== null && value !== '') {
    //     if (typeof value === 'string') {
    //       query.andWhere(`op.${key} LIKE :${key}`, { [key]: `%${value}%` });
    //     } else if (typeof value === 'number') {
    //       query.andWhere(`op.${key} = :${key}`, { [key]: value });
    //     }
    //   }
    // });

    validFields.forEach(key => {
      const value = search[key];
      console.log(value)
      if (value !== undefined && value !== null && value !== '') {
        if (value && key === 'data_inserimento' || key === 'data_scadenza' || key === 'data_attivazione') {
          const newValue = JSON.parse(value)
          console.log('newValue: ', newValue)
          const fromDate = newValue.from;
          const toDate = newValue.to;
          query.andWhere(
            `DATE(op.${key}) BETWEEN :${key}From AND :${key}To`,
            {
              [`${key}From`]: fromDate,
              [`${key}To`]: toDate
            }
          )
        }
        const tableAlias = fieldMappings[key] || 'op';  // default a 'op' si no está mapeado
        console.log('tableAlias: ', tableAlias)
        if (typeof value === 'string' && key !== 'data_inserimento' && key !== 'data_attivazione' && key !== 'data_scadenza') {
          query.andWhere(`${tableAlias}.${key} LIKE :${key}`, {
            [key]: `%${value}%`
          });

        } else if (typeof value === 'number') {
          query.andWhere(`${tableAlias}.${key} = :${key}`, {
            [key]: value
          });
        }
      }
    });
  }

  private validateUser(email: string): Promise<User> {

    const user = this.usersService.findByUsername(email)

    if (!user) throw new NotFoundException('Usuario no encontrado');

    return user;
  }
}
