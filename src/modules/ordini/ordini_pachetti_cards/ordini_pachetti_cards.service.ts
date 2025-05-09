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

  async create(createOrdiniPachettiCardDto: any) {
    createOrdiniPachettiCardDto.data_attivazione = format(new Date(createOrdiniPachettiCardDto.data_attivazione), 'yyyy-MM-dd');
    createOrdiniPachettiCardDto.data_scadenza = format(new Date(createOrdiniPachettiCardDto.data_scadenza), 'yyyy-MM-dd');
    const model = {
      ...createOrdiniPachettiCardDto,
      data_inserimento: format(new Date(), 'yyyy-MM-dd'),
      id_proforma: 0,
      is_deleted: false
    };

    const { cardData, ...filteredModel } = model;
    console.log('filteredModel: ', filteredModel)

    return this.dataSource.transaction(async (manager) => {
      // Insert main order
      const orderResult = await manager
        .createQueryBuilder()
        .insert()
        .into('ordini__pacchetti_cardss')
        .values(filteredModel)
        .execute();

      const orderId = orderResult.raw?.insertId;
      console.log('orderId: ', orderId)

      // Filter and prepare card data
      const filteredCardData = Object.entries(cardData)
        .filter(([_, item]) => (item as CardItem).quantita > 0)
        .map(([key, item]) => {
          const cardItem = item as CardItem;
          return {
            soccorso: key,
            prezzo: cardItem.prezzo,
            quantita: cardItem.quantita,
            prezzo_netto: cardItem.netto,
            totale: cardItem.totale,
            ordine: orderId,
            omaggio: cardItem.omaggio || 0,
          };
        });

      // Calculate total amount
      const importoTot = filteredCardData.reduce((sum, card) => sum + card.totale, 0);

      // Batch insert card quantities
      if (filteredCardData.length > 0) {
        // Especificar explícitamente los nombres de las columnas en la sentencia INSERT
        const columns = ['soccorso', 'quantita', 'prezzo_netto', 'ordine', 'omaggio'];

        const values = filteredCardData.map(card => {
          const { totale, prezzo, ...filteredData } = card;
          return [
            filteredData.soccorso,
            filteredData.quantita,
            filteredData.prezzo_netto,
            filteredData.ordine,
            filteredData.omaggio
          ];
        });

        // Construir SQL crudo para la inserción por lotes con columnas explícitas
        const placeholders = values.map(() => '(?, ?, ?, ?, ?)').join(', ');
        const sqlParams = values.flat();

        await manager.query(
          `INSERT INTO ordini__pacchetti_cardss_quantita (${columns.join(', ')}) VALUES ${placeholders}`,
          sqlParams
        );
      }

      // Get dealer info
      const [infoDealer] = await manager.query('SELECT * FROM dealers WHERE id = ?', [model.dealer]);

      // Format date
      const formattedDate = model.pagamento__data
        ? format(endOfMonth(new Date()), 'yyyy-MM-dd')
        : format(new Date(), 'yyyy-MM-dd');
      console.log('formattedDate: ', formattedDate)
      // Create proforma
      const proforma = {
        tipo_cliente: 0,
        id_cliente: infoDealer.id,
        agente: infoDealer.agente,
        tipo_proforma: 3,
        importo: importoTot.toFixed(2),
        data_inserimento: new Date(),
        data_proforma: formattedDate,
        data_invio: '1900-01-01',
        pagamento__rate: model.rate,
        pagamento__differita: model.prima_rata,
        pagamento__periodo: model.periodo,
        is_deleted: false
      };

      const proformaResult = await manager
        .createQueryBuilder()
        .insert()
        .into('proforma')
        .values(proforma)
        .execute();

      const proformaId = proformaResult.raw?.insertId;

      // Update the order with proforma ID
      await manager
        .createQueryBuilder()
        .update('ordini__pacchetti_cardss')
        .set({ id_proforma: proformaId })
        .where('id = :id', { id: orderId })
        .execute();

      return { orderId, proformaId, importoTot };
    });
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


  async update(id: number, updateOrdiniPachettiCardDto: any) {
    return await this.dataSource.transaction(async (manager) => {
      const { cardData, ...orderData } = updateOrdiniPachettiCardDto;

      // 1. Update main order record
      await manager.update(
        'ordini__pacchetti_cardss',
        { id },
        orderData
      );

      // 2. Process and update card items
      const cardUpdates = Object.entries(cardData)
        .filter(([_, item]) => (item as CardItem).quantita > 0)
        .map(([soccorso, item]) => {
          const { totale, prezzo, netto, ...cardItem } = item as CardItem;
          return {
            ...cardItem,
            soccorso,
            prezzo_netto: netto,
            ordine: id, // Assuming this should be the order ID
            omaggio: cardItem.omaggio || 0,
          };
        });

      // Batch update card items
      for (const card of cardUpdates) {
        await manager.update(
          'ordini__pacchetti_cardss_quantita',
          { id: card.id },
          card
        );
      }

      // 3. Handle proforma if exists
      const [proforma] = await manager.query(
        'SELECT 1 FROM proforma WHERE id = ? AND is_deleted = 0 LIMIT 1',
        [orderData.id_proforma]
      );

      if (proforma) {
        await this.proformaService.recalcTotaleProforma(orderData.id_proforma);
        await this.proformaService.genPdfProforma(orderData.id_proforma);
      }
    });
  }

  async remove(id: number) {

    const result = await this.dataSource
      .createQueryBuilder()
      .update('ordini__pacchetti_cardss')
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

  private validateUser(email: string): Promise<User | any> {

    const user = this.usersService.findByUsername(email)

    if (!user) throw new NotFoundException('Usuario no encontrado');

    return user;
  }
}
