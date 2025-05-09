import { forwardRef, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { CreateOrdiniPachettiDto } from './dto/create-ordini_pachetti.dto';
import { UpdateOrdiniPachettiDto } from './dto/update-ordini_pachetti.dto';
import { DataSource, EntityManager, SelectQueryBuilder } from 'typeorm';
import { InjectDataSource, InjectEntityManager } from '@nestjs/typeorm';
import { OrdiniSearch } from './interface/ordini_pachetti.interface';
import { UsersService } from 'src/modules/users/users.service';
import { User } from 'src/interfaces/interfaces';
import { addYears, endOfMonth, format } from 'date-fns';
import { LogService } from 'src/modules/operation/log/log.service';
import { ProformaService } from 'src/modules/Fatture/proforma/proforma.service';
import { DisponibilitaPacchettiService } from 'src/modules/Guarantees/disponibilita_pacchetti/disponibilita_pacchetti.service';
import { Console } from 'console';
import { WrapperType } from 'src/generate-metadata';

export const OrdiniSearchKeys = [
  'id',
  'denominazione',
  'sigla',
  ',data_inserimento',
  ',data_attivazione',
  ',data_scadenza'
]

const KM_SOCCORSI = [
  '0',
  '40',
  '60',
  '100'
];

interface DisponibilitaItem {
  id: number;
  dealer: number;
  prodotto: number;
  disponibilidad_total: number;
}

interface AddNewDisp {
  garanzie: {
    [key: string]: number;
  };
  extra: {
    [key: string]: number;
  };
}

interface DisponibilidadExtra {
  [key: string]: number | { disponibilidad: number }[];
}

interface Garanzia {
  id: number;
  data_attivazione: string | Date;
  durata: number | string;
  tipo_garanzia: string | number;
  soccorso__km?: number;
  soccorso__auto_sostitutiva?: boolean;
  consumo_pack?: number;
}

interface Dealer {
  data_proforma_singole_garanzie: boolean;
  agente: number;
  pagamento__rate: number;
  pagamento__differita: number;
  pagamento__periodo: number;
}

interface Proforma {
  id?: number;
  tipo_cliente: number;
  id_cliente: number;
  agente: number;
  tipo_proforma: number;
  importo: number;
  data_inserimento: string;
  data_invio: string;
  data_proforma: string;
  pagamento__rate: number;
  pagamento__differita: number;
  pagamento__periodo: number;
  is_deleted: boolean;
  attributes?: any;
}

@Injectable()
export class OrdiniPachettiService {

  constructor(

    @InjectEntityManager() private entityManager: EntityManager,

    @InjectDataSource() private dataSource: DataSource,

    private usersService: UsersService,

    private logService: LogService,

    @Inject(forwardRef(() => ProformaService))
    private proformaService: WrapperType<ProformaService>,

    private disponibilitaPacchettiService: DisponibilitaPacchettiService

  ) { }

  async create(createOrdiniPachettiDto: any) {

    const model = createOrdiniPachettiDto;

    model.id_proforma = 0;
    model.data_inserimento = new Date();
    model.is_deleted = false;
    model.data_attivazione = format(model.data_attivazione, 'yyyy-MM-dd');
    model.data_scadenza = format(addYears(model.data_scadenza, 1), 'yyyy-MM-dd');

    // Se delle garanzie precedentemente a consumo rientrano ora nel pack,
    // Il proforma in cui venivano pagate deve essere rigenerato
    let proforma_da_rigenerare = [];
    const { post, prod_extra, ...filteredModel } = model;

    return await this.dataSource.transaction(async (manager) => {

      const [pagamento] = await manager.query(`
        SELECT pagamento__data FROM dealers WHERE id = ?
      `, [model.dealer]);

      filteredModel.pagamento__data = pagamento.pagamento__data;

      const is_saved = await manager
        .createQueryBuilder()
        .insert()
        .into('ordini__pacchetti')
        .values(
          filteredModel
        )
        .execute();
      await manager.query('COMMIT');

      if (is_saved) {

        await this.logService.create(1, 'pack_gr', is_saved.raw?.insertId, '', model.attributes, 'default')

        // Selezione delle garanzie abilitate per il dealer
        const garanzieAbilitate = await manager.query(`
          SELECT * FROM dealers__garanzie_abilitate WHERE dealer = ? AND attivo = 1
        `, [model.dealer])

        const tipi = await manager.query(`
          SELECT dga.id FROM dealers__garanzie_abilitate dga WHERE dealer = ?
        `, [model.dealer])

        let importo_tot = 0;
        let index = 0;

        for (let record of garanzieAbilitate) {

          const productKey = tipi[index].id;

          if (post[productKey] && (post[productKey].quantita !== 0 || post[productKey].omaggio !== 0)) {
            const productPost = post[productKey]; // Accedemos al producto específico

            let prodotto_model = await manager.query('SELECT * FROM ordini__prodotti_quantita WHERE ordine = ? AND prodotto = ? AND is_extra = false', [is_saved.raw?.insertId, record.tipo_garanzia])
            if (!prodotto_model) {
              prodotto_model = {
                ordine: is_saved.raw?.insertId,
                prodotto: record.tipo_garanzia
              }
            }

            prodotto_model = {
              is_extra: false,
              prodotto: index + 1,
              ordine: is_saved.raw?.insertId,
              quantita: Number(productPost.quantita),
              prezzo_netto: productPost.prezzo_netto,
              omaggio: Number(productPost.omaggio)
            }

            const prodotto = await manager
              .createQueryBuilder()
              .insert()
              .into('ordini__prodotti_quantita')
              .values(prodotto_model)
              .execute();

            await this.logService.create(1, 'pack_gr_qta', prodotto.raw?.insertId, '', prodotto_model.attributes, 'default')

            /**
           * Ricerca di tutte le garanzie del tipo `$record->tipo_garanzia` attivate dopo il pack
           * @var Garanzie[] $garanzie_to_edit
           */
            const garanzie_to_edit = await manager
              .createQueryBuilder()
              .select('g.*')
              .from('garanzie', 'g')
              .where('g.dealer = :dealer', { dealer: model.dealer })
              .andWhere('g.tipo_garanzia = :tipoGaranzia', { tipoGaranzia: record.tipo_garanzia })
              .andWhere('g.id_proforma != :proformaId', { proformaId: 0 })
              .andWhere('g.data_attivazione >= :dataAttivazione', { dataAttivazione: model.data_attivazione })
              .orderBy('g.data_attivazione', 'ASC')
              .addOrderBy('g.id', 'ASC')
              .take(prodotto_model.quantita + prodotto_model.omaggio)
              .getRawMany();

            console.log('garanzie_to_edit___ ', garanzie_to_edit)
            /**
          * Salva id_proforma delle garanzie per rigenerarlo;
          * Successivamente, la funzione Proforma::recalcTotaleProforma 
          * valuterà quali di queste rientrano nel pack e quali no
          */
            proforma_da_rigenerare = garanzie_to_edit
              .map(garantia => garantia.id_proforma)
              .filter(id => id !== null && id !== undefined);

            /**
             * @var int $qta_residua Quantità residua di garanzie che è possibile scalare da questo pack
             */
            let qta_residua = prodotto_model.quantita + prodotto_model.omaggio;

            for (let garanzie of garanzie_to_edit) {
              if (qta_residua > 0) {
                const old_gr = { ...garanzie };

                /**
               * @var int La quantità effettiva di gr consumate da questo record
               */
                const consumo_garanzia: number = Math.floor(garanzie.durata / 12);

                // La garanzia poteva essere parzialmente da pack;
                // Il consumo da scalare dal pack esclude la quantità di gr. già
                // scalata da pack precedentemente attivati

                /**
                 * @var int $consumo_da_scalare La quantità rimanente che è possibile scalare dal pack
                 */
                const consumo_da_scalare = Math.min(
                  consumo_garanzia - garanzie.consumo_pack,
                  qta_residua
                );
                // Viene impostato il consumo che è possibile scalare sul record
                garanzie.consumo_pack += consumo_da_scalare;

                // Il proforma associato a questa garanzia, se presente, dovrà essere ricalcolato                
                proforma_da_rigenerare.push(garanzie.id_proforma);

                // Se il record è ora completamente da pack, il record non rientrerà in nessun proforma
                if (consumo_garanzia === garanzie.consumo_pack) garanzie.id_proforma = 0;

                // Viene decrementato il numero di gr residue per questo tipo garanzia
                qta_residua -= consumo_da_scalare;
                const id_garanzie = garanzie.id
                await manager
                  .createQueryBuilder()
                  .update('garanzie')
                  .set(garanzie)
                  .where('id = :id_garanzie', { id_garanzie })
                  .execute();

                await this.logService.create(2, 'garanzie', id_garanzie, old_gr.attributes, garanzie.attributes, 'default')

                // delete old_gr;
                // delete garanzie;
              }

              console.log('importo_tot___ ', importo_tot)
            }
            importo_tot += prodotto_model.prezzo_netto * productPost.quantita;
          }
          index++
        }

        const [info_dealer] = await manager.query('SELECT * FROM dealers WHERE id = ?', [model.dealer])

        for (let [extra_id, extra] of Object.entries(model.prod_extra)) {
          //@ts-ignore
          if (
            [1, 2, 3, 5].includes(Number(extra_id)) &&
            typeof extra === 'object' &&
            extra !== null &&
            'qta' in extra &&
            'omaggio' in extra &&
            'netto' in extra &&
            (extra.qta !== 0 || extra.omaggio !== 0)
          ) {

            let extra_model = await manager.query('SELECT * FROM ordini__prodotti_quantita WHERE ordine = ? AND prodotto = ? AND is_extra = true', [model.id, extra_id]);
            if (!extra_model) {
              // extra_model.ordine = model.id;
              // extra_model.prodotto = extra_id;
              extra_model = {
                ordine: is_saved.raw?.insertId,
                prodotto: extra_id
              }
            }
            extra_model = {
              is_extra: true,
              prodotto: extra_id,
              ordine: is_saved.raw?.insertId,
              quantita: Number(extra.qta),
              prezzo_netto: Number(extra.netto),
              omaggio: Number(extra.omaggio)
            }

            await manager
              .createQueryBuilder()
              .insert()
              .into('ordini__prodotti_quantita')
              .values(extra_model)
              .execute();

            switch (extra_id) {
              case '1': // Soccorso stradale
              case '2':
              case '3':
                const garanzie_to_edit = await this.entityManager
                  .createQueryBuilder()
                  .from('garanzie', 'garanzie')
                  .where('garanzie.dealer = :dealer', { dealer: model.dealer })
                  .andWhere('garanzie.soccorso__km = :soccorsoKm', {
                    soccorsoKm: KM_SOCCORSI[extra_id]
                  })
                  .andWhere('garanzie.data_attivazione >= :dataAttivazione', {
                    dataAttivazione: model.data_attivazione
                  })
                  .andWhere('garanzie.id_proforma_soccorso != :zero', { zero: 0 })
                  .orderBy('garanzie.data_attivazione', 'ASC')
                  .addOrderBy('garanzie.id', 'ASC')
                  .limit(extra_model.quantita + extra_model.omaggio)
                  .getRawMany();

                proforma_da_rigenerare = garanzie_to_edit
                  .map(garantia => garantia.id_proforma_soccorso)
                  .filter(id => id !== null && id !== undefined);

                /**
             * @var int $qta_residua Quantità residua di questo extra che è possibile scalare da questo pack
             */

                let qta_extra_residual = extra_model.quantita + extra_model.omaggio;

                for (let garanzia of garanzie_to_edit) {
                  if (qta_extra_residual > 0) {
                    const old_gr = { ...garanzia };

                    const consumo_garanzia: number = Math.floor(garanzia.durata / 12);

                    const consumo_da_scalare = Math.min(
                      consumo_garanzia - garanzia.consumo_pack,
                      qta_extra_residual
                    );

                    garanzia.consumo_pack += consumo_da_scalare;
                    proforma_da_rigenerare.push(garanzia.id_proforma);

                    if (consumo_garanzia === garanzia.consumo_pack_soccorso) garanzia.id_proforma_soccorso = 0;
                    qta_extra_residual -= consumo_da_scalare;

                    const id_garanzie = garanzia.id
                    await manager
                      .createQueryBuilder()
                      .update('garanzie')
                      .set(garanzia)
                      .where('id = :id_garanzie', { id_garanzie })
                      .execute();

                    await this.logService.create(2, 'garanzie', id_garanzie, old_gr.attributes, garanzia.attributes, 'default')
                  }
                }
                break;
              case '5': // Auto sostitutiva
                const garanzie_to_edit_auto = await this.entityManager
                  .createQueryBuilder()
                  .from('garanzie', 'garanzie')
                  .where('garanzie.dealer = :dealer', { dealer: model.dealer })
                  .andWhere('garanzie.soccorso__auto_sostitutiva = 1')
                  .andWhere('garanzie.data_attivazione >= :dataAttivazione', {
                    dataAttivazione: model.data_attivazione
                  })
                  .andWhere('garanzie.id_proforma_autosost != 0')
                  .orderBy('garanzie.data_attivazione', 'ASC')
                  .addOrderBy('garanzie.id', 'ASC')
                  .limit(extra_model.quantita + extra_model.omaggio)
                  .getRawMany();

                proforma_da_rigenerare = garanzie_to_edit_auto
                  .map(garantia => garantia.id_proforma)
                  .filter(id => id !== null && id !== undefined);

                let qta_extra_resid = extra_model.quantita + extra_model.omaggio;
                for (let garanzia of garanzie_to_edit_auto) {
                  if (qta_extra_resid > 0) {
                    const old_gr = { ...garanzia };

                    const consumo_garanzia: number = Math.floor(garanzia.durata / 12);

                    const consumo_da_scalare = Math.min(
                      consumo_garanzia - garanzia.consumo_pack_autosost,
                      qta_extra_resid
                    );

                    garanzia.consumo_pack_autosost += consumo_da_scalare;
                    proforma_da_rigenerare.push(garanzia.id_proforma_autosost);

                    if (consumo_garanzia === garanzia.consumo_pack_autosost) garanzia.id_proforma_autosost = 0;
                    qta_extra_resid -= consumo_da_scalare;

                    const id_garanzie = garanzia.id
                    await manager
                      .createQueryBuilder()
                      .update('garanzie')
                      .set(garanzia)
                      .where('id = :id_garanzie', { id_garanzie })
                      .execute();

                    await this.logService.create(2, 'garanzie', id_garanzie, old_gr.attributes, garanzia.attributes, 'default')
                  }
                }
                break;
              default:
            }

          }
        }

        const today = new Date();
        const data_pf = model.data_attivazione !== format(today, 'yyyy-MM-dd')
          ? model.data_attivazione
          : model.pagamento__data
            ? format(endOfMonth(today), 'yyyy-MM-dd')  // Último día del mes
            : format(today, 'yyyy-MM-dd');

        console.log('Final data_pf:', data_pf);

        const proforma = {
          'tipo_cliente': 0,
          'id_cliente': info_dealer.id,
          'agente': info_dealer.agente,
          'tipo_proforma': 1,
          'importo': importo_tot.toFixed(2),
          'data_inserimento': new Date(),
          'data_proforma': data_pf,
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
          .update('ordini__pacchetti')
          .set({ id_proforma: pf_found.raw?.insertId })
          .where('id = :id', { id: is_saved.raw?.insertId })
          .execute();

        const uniqueProforma = new Set(proforma_da_rigenerare);
        for (const idProformaRegen of uniqueProforma) {
          await this.proformaService.recalcTotaleProforma(idProformaRegen)
          //await this.proformaService.recalcTotaleProforma(insertedProforma[0].id)
          //Proforma.genPdfProforma(idProformaRegen, this);
        }
      }
    })
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
      .select('op.*')
      .from('v_ordini', 'op')
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
        .from('ordini__prodotti_quantita', 'opq')
        .where('opq.ordine = :ordineId', { ordineId: ordine.id })
        .andWhere('opq.is_deleted = 0')
        .getRawMany();

      return {
        ...ordine,
        products
      };
    }));

    return { ordini: ordiniWithProducts, total };
  }

  async findOne(id: number) {
    const query = this.entityManager.createQueryBuilder()
      .select('op.*')
      .from('ordini__pacchetti', 'op')
      .innerJoin('dealers', 'd', 'op.dealer = d.id')
      .where('op.id = :id', { id: id });

    const ordini = await query.getRawMany();
    // Fetch products for each order
    const ordiniWithProducts = await Promise.all(ordini.map(async (ordine) => {
      const products = await this.entityManager
        .createQueryBuilder()
        .select('*')
        .from('ordini__prodotti_quantita', 'opq')
        .where('opq.ordine = :ordineId', { ordineId: id })
        .andWhere('opq.is_deleted = 0')
        .getRawMany();

      return {
        ...ordine,
        products
      };
    }));

    return ordiniWithProducts
  }

  async tipiGaranziePerdealer(dealer: any) {
    const query = this.entityManager.createQueryBuilder()
      .select('dga.*, tg.denominazione, tg.prezzo_listino')
      .from('dealers__garanzie_abilitate', 'dga')
      .innerJoin('tipi_garanzie', 'tg', 'dga.tipo_garanzia = tg.id')
      .where('dga.dealer = :dealer', { dealer: dealer })
      .andWhere('dga.attivo = 1')
      .getRawMany();
    return query
  }

  async tipiGaranzieToPerdealer(ordine: any, dealer: any) {
    const query = this.entityManager.createQueryBuilder()
      .select([
        'tg.id',
        'tg.denominazione',
        'tg.prezzo_listino',
        'COALESCE(opq.ordine, 0) as ordine',
        'COALESCE(opq.quantita, 0) as quantita',
        'COALESCE(opq.omaggio, 0) as omaggio',
        'COALESCE(opq.prezzo_netto, 0) as prezzo_netto'
      ])
      .from('tipi_garanzie', 'tg')
      .leftJoin('dealers__garanzie_abilitate', 'dga',
        'dga.tipo_garanzia = tg.id AND dga.dealer = :dealer',
        { dealer: dealer })
      .leftJoin('ordini__prodotti_quantita', 'opq',
        'dga.tipo_garanzia = opq.prodotto AND opq.ordine = :ordine AND opq.is_deleted = 0 AND opq.is_extra = 0',
        { ordine: ordine })
      .getRawMany();

    const extra = this.entityManager.createQueryBuilder()
      .select([
        'tg.id',
        'tg.denominazione',
        'tg.prezzo_listino',
        'COALESCE(opq.ordine, 0) as ordine',
        'COALESCE(opq.quantita, 0) as quantita',
        'COALESCE(opq.omaggio, 0) as omaggio',
        'COALESCE(opq.prezzo_netto, 0) as prezzo_netto',
        'COALESCE(opq.is_extra, 0) as is_extra'
      ])
      .from('tipi_garanzie', 'tg')
      .leftJoin('dealers__garanzie_abilitate', 'dga',
        'dga.tipo_garanzia = tg.id AND dga.dealer = :dealer',
        { dealer: dealer })
      .leftJoin('ordini__prodotti_quantita', 'opq',
        'dga.tipo_garanzia = opq.prodotto AND opq.ordine = :ordine AND opq.is_deleted = 0 AND opq.is_extra = 1',
        { ordine: ordine })

      .getRawMany();

    const data = {
      query: await query,
      extra: await extra
    }

    console.log('query:___', data);
    return data;
  }

  async update(id: number, updateOrdiniPachettiDto: any) {

    const modelDTO = updateOrdiniPachettiDto

    return await this.dataSource.transaction(async (manager) => {


      const [model] = await manager.query('SELECT * FROM ordini__pacchetti WHERE id = ?', [id])

      const all_gr_durante_old_pack = await manager.query('SELECT * FROM garanzie WHERE dealer = ? AND data_attivazione >= ? AND data_attivazione <= ?', [modelDTO.dealer, model.data_attivazione, model.data_attivazione])

      // Organizar garantías por tipo y servicio de rescate
      const gr_old_pack_by_tipo = all_gr_durante_old_pack.reduce((acc, item) => {
        if (!acc[item.tipo_garanzia]) {
          acc[item.tipo_garanzia] = {};
        }
        acc[item.tipo_garanzia][item.id] = item;
        return acc;
      }, {});

      const gr_old_pack_by_soccorso = all_gr_durante_old_pack.reduce((acc, item) => {
        if (!acc[item.soccorso__km]) {
          acc[item.soccorso__km] = {};
        }
        acc[item.soccorso__km][item.id] = item;
        return acc;
      }, {});

      delete gr_old_pack_by_soccorso[0];

      const id_tipi_soccorso = { 40: 1, 60: 2, 100: 3 };

      // Filtrar garantías con auto sustitutivo
      const gr_old_pack_autosost = all_gr_durante_old_pack
        .filter(garanzia => !!garanzia.soccorso__auto_sostitutiva)
        .reduce((acc, item) => {
          acc[item.id] = item;
          return acc;
        }, {});

      // Obtener disponibilidad antes de la edición
      const [disp_gr_before_edit] = await manager.query(
        'SELECT * FROM v_dealer_disponibilita WHERE dealer = ?',
        [modelDTO.dealer]
      );

      const [disp_extra_before_edit] = await manager.query(
        'SELECT * FROM v_disponibilita_soccorso WHERE dealer = ?',
        [modelDTO.dealer]
      );

      const qta_old_pack = await manager.query(
        'SELECT prodotto, SUM(quantita + omaggio) as total FROM ordini__prodotti_quantita WHERE ordine = ? AND is_extra = 0 GROUP BY prodotto',
        [model.id]
      ).then(results =>
        results.reduce((acc, item) => {
          acc[item.prodotto] = item.total;
          return acc;
        }, {})
      );

      const qta_extra_old_pack = await manager.query(
        'SELECT prodotto, SUM(quantita + omaggio) as total FROM ordini__prodotti_quantita WHERE ordine = ? AND is_extra = 1 GROUP BY prodotto',
        [model.id]
      ).then(results =>
        results.reduce((acc, item) => {
          acc[item.prodotto] = item.total;
          return acc;
        }, {})
      );

      const disp_gr_excluding_pack = {};
      Object.entries(disp_gr_before_edit).forEach(([tipo_gr, rimanenza]) => {
        disp_gr_excluding_pack[tipo_gr] = parseInt(String(rimanenza)) - parseInt(String(qta_old_pack[tipo_gr] || 0));
      });

      const disp_extra_excluding_pack = {};
      Object.entries(disp_extra_before_edit).forEach(([tipo_extra, rimanenza]) => {
        disp_extra_excluding_pack[tipo_extra] = parseInt(String(rimanenza)) - parseInt(String(qta_extra_old_pack[tipo_extra] || 0));
      });

      const garanzie_da_pagare = [];
      const soccorsi_da_pagare = [];
      const autosost_da_pagare = [];

      const add_new_disp: AddNewDisp = {
        garanzie: {},
        extra: {}
      };

      for (const [tipo_gr, garanzie_per_tipo] of Object.entries(gr_old_pack_by_tipo)) {
        let disp_residua = disp_gr_excluding_pack[tipo_gr] || 0;
        if (disp_residua < 0) {
          disp_residua = 0;
        }

        // Ordenar garantías por fecha de activación y id
        const garantiasSorted = Object.values(garanzie_per_tipo).sort((a, b) => {
          const dateComparison = new Date(a.data_attivazione).getTime() - new Date(b.data_attivazione).getTime();
          return dateComparison === 0 ? a.id - b.id : dateComparison;
        });

        for (const garanzia of garantiasSorted) {
          // Si la garantía fue activada durante la duración del nuevo paquete, la procesaremos después
          console.log('// Si la garantía fue activada durante la duración del nuevo paquete, la procesaremos después')
          if (
            new Date(garanzia.data_attivazione) >= new Date(model.data_attivazione) &&
            new Date(garanzia.data_attivazione) <= new Date(model.data_scadenza)
          ) {
            await manager.query(
              'UPDATE garanzie SET consumo_pack = ? WHERE id = ?',
              [0, garanzia.id]
            );
            continue;
          }

          // Calcular el consumo del paquete
          const consumo_pack_gr = Math.min(disp_residua, parseInt(String(garanzia.durata)) / 12);
          console.log('consumo_pack_gr___ ', consumo_pack_gr)
          disp_residua -= consumo_pack_gr;
          console.log('disp_residua___ ', disp_residua)
          // Si la garantía no está completamente cubierta por disp_residua, agregarla a garanzie_da_pagare
          if (consumo_pack_gr < parseInt(String(garanzia.durata)) / 12) {
            console.log('consumo_pack_gr___ ', consumo_pack_gr)
            garanzia.consumo_pack = consumo_pack_gr
            console.log('garanzia___ ', garanzia)
            garanzie_da_pagare.push(garanzia);

            if (!add_new_disp['garanzie'][tipo_gr]) {

              add_new_disp['garanzie'][tipo_gr] = 0;
            }

            add_new_disp['garanzie'][tipo_gr] +=
              parseInt(String(garanzia.durata)) / 12 - consumo_pack_gr;
          }
        }
      }

      // Procesar cada tipo de servicio de rescate
      for (const [km_soccorso, garanzie_per_soccorso] of Object.entries(gr_old_pack_by_soccorso)) {
        const tipo_ss = id_tipi_soccorso[parseInt(km_soccorso)] || 0;
        if (tipo_ss === 0) continue; // Esto nunca debería ocurrir

        let disp_residua_ss = disp_extra_before_edit[tipo_ss] || 0;
        if (disp_residua_ss < 0) {
          disp_residua_ss = 0;
        }

        // Ordenar garantías por fecha de activación y id
        const garantiasSorted = Object.values(garanzie_per_soccorso).sort((a, b) => {
          const dateComparison = new Date(a.data_attivazione).getTime() - new Date(b.data_attivazione).getTime();
          return dateComparison === 0 ? a.id - b.id : dateComparison;
        });

        // Procesar cada garantía
        for (const garanzia of garantiasSorted) {
          // Si la garantía fue activada durante la duración del nuevo paquete, la procesaremos después
          if (
            new Date(garanzia.data_attivazione) >= new Date(model.data_attivazione) &&
            new Date(garanzia.data_attivazione) <= new Date(model.data_scadenza)
          ) {
            await manager.query(
              'UPDATE garanzie SET consumo_pack_soccorso = ? WHERE id = ?',
              [0, garanzia.id]
            );
            continue;
          }

          // Calcular el consumo del paquete de servicio de rescate
          const consumo_pack_ss = Math.min(disp_residua_ss, parseInt(String(garanzia.durata)) / 12);
          disp_residua_ss -= consumo_pack_ss;

          // Si el servicio de rescate no está completamente cubierto por disp_residua_ss
          if (consumo_pack_ss < parseInt(String(garanzia.durata)) / 12) {
            await manager.query(
              'UPDATE garanzie SET consumo_pack_soccorso = ? WHERE id = ?',
              [consumo_pack_ss, garanzia.id]
            );

            soccorsi_da_pagare.push(garanzia);

            if (!add_new_disp['extra']) {
              add_new_disp['extra'] = {};
            }
            if (!add_new_disp['extra'][tipo_ss]) {
              add_new_disp['extra'][tipo_ss] = 0;
            }

            add_new_disp['extra'][tipo_ss] +=
              parseInt(String(garanzia.durata)) / 12 - consumo_pack_ss;
          }
        }
      }

      // Procesar auto sustitutivos
      let disp_residua_autosost = disp_extra_before_edit[5] || 0;
      if (disp_residua_autosost < 0) {
        disp_residua_autosost = 0;
      }

      // Ordenar por fecha de activación y id
      const autoSostSorted = Object.values(gr_old_pack_autosost).sort((a: any, b: any) => {
        const dateComparison = new Date(a.data_attivazione).getTime() - new Date(b.data_attivazione).getTime();
        return dateComparison === 0 ? a.id - b.id : dateComparison;
      });

      // Procesar cada garantía de auto sustitutivo
      for (const garanzia of autoSostSorted) {
        if (
          //@ts-ignore
          new Date(garanzia.data_attivazione) >= new Date(model.data_attivazione) &&
          //@ts-ignore
          new Date(garanzia.data_attivazione) <= new Date(model.data_scadenza)
        ) {
          await manager.query(
            'UPDATE garanzie SET consumo_pack_autosost = ? WHERE id = ?',
            //@ts-ignore
            [0, garanzia.id]
          );
          continue;
        }
        //@ts-ignore
        const consumo_pack_autosost = Math.min(disp_residua_autosost, parseInt(String(garanzia.durata)) / 12);
        disp_residua_autosost -= consumo_pack_autosost;

        // Si el auto sustitutivo no está completamente cubierto
        //@ts-ignore
        if (consumo_pack_autosost < parseInt(String(garanzia.durata)) / 12) {
          await manager.query(
            'UPDATE garanzie SET consumo_pack_autosost = ? WHERE id = ?',
            //@ts-ignore
            [consumo_pack_autosost, garanzia.id]
          );

          autosost_da_pagare.push(garanzia);

          if (!add_new_disp['extra']) {
            add_new_disp['extra'] = {};
          }
          if (!add_new_disp['extra'][5]) {
            add_new_disp['extra'][5] = 0;
          }
          //@ts-ignore
          add_new_disp['extra'][5] += parseInt(String(garanzia.durata)) / 12 - consumo_pack_autosost;
        }
      }

      const ordine = model.id
      await manager
        .createQueryBuilder()
        .update('ordini__prodotti_quantita')
        .set({ is_deleted: 1 })
        .where("ordine = :ordine", { ordine })
        .execute();

      // Remove old records
      console.log('DTO::: ', modelDTO)
      const { post, prod_extra } = modelDTO;

      const productos = Object.values(post);
      console.log('productos__ ', productos)
      for (const producto of productos) {
        // Solo procesamos productos con cantidad o regalo
        //@ts-ignore
        if (producto.quantita !== 0 || producto.omaggio !== 0) {
          const prodotto_model = {
            is_extra: false,
            //@ts-ignore
            prodotto: producto.tipo_garanzia,
            ordine: ordine,
            //@ts-ignore
            quantita: Number(producto.quantita),
            //@ts-ignore
            prezzo_netto: producto.prezzo_netto,
            //@ts-ignore
            omaggio: Number(producto.omaggio)
          };

          await manager
            .createQueryBuilder()
            .insert()
            .into('ordini__prodotti_quantita')
            .values(prodotto_model)
            .execute();
        }
      }


      for (let [extra_id, extra] of Object.entries(prod_extra)) {
        //@ts-ignore
        if (
          [1, 2, 3, 5].includes(Number(extra_id)) &&
          typeof extra === 'object' &&
          extra !== null &&
          'qta' in extra &&
          'omaggio' in extra &&
          'netto' in extra &&
          (extra.qta !== 0 || extra.omaggio !== 0)
        ) {

          let extra_model = {
            is_extra: true,
            prodotto: extra_id,
            ordine: ordine,
            quantita: Number(extra.qta),
            prezzo_netto: Number(extra.netto),
            omaggio: Number(extra.omaggio)
          }

          await manager
            .createQueryBuilder()
            .insert()
            .into('ordini__prodotti_quantita')
            .values(extra_model)
            .execute();

        }
      }

      // const [dealer] = await manager.query('SELECT * FROM dealers WHERE id = ?', [model.dealer])
      const disp_gr_after_edit: DisponibilitaItem[] = await this.disponibilitaPacchettiService.getAllDisponibilitaDealer(model.dealer)

      const disp_extra_after_edit: DisponibilidadExtra = await this.disponibilitaPacchettiService.getDisponibilitaSoccorsiAndAuto(model.dealer)


      // Crear un nuevo objeto para almacenar los resultados actualizados
      const updatedDisp = disp_gr_after_edit.map(item => {
        // Usar prodotto como índice para add_new_disp
        const additional = add_new_disp.garanzie[item.prodotto] || 0;

        return {
          ...item,
          disponibilidad_total: item.disponibilidad_total + additional
        };
      });

      // Si necesitas mantener el formato original:
      const dispByProdotto = updatedDisp.reduce((acc, item) => {
        acc[item.prodotto] = item.disponibilidad_total;
        return acc;
      }, {} as Record<number, number>);


      Object.keys(disp_extra_after_edit).forEach((id: string) => {
        const qta = Array.isArray(disp_extra_after_edit[id])
          ? disp_extra_after_edit[id][0].disponibilidad
          : disp_extra_after_edit[id];

        const additional = add_new_disp.extra[id] || 0;

        // Si el valor original era un array, mantener la estructura
        if (Array.isArray(disp_extra_after_edit[id])) {
          disp_extra_after_edit[id] = [{
            disponibilidad: parseInt(String(qta)) + parseInt(String(additional))
          }];
        } else {
          disp_extra_after_edit[id] = parseInt(String(qta)) + parseInt(String(additional));
        }
      });

      console.log('disp_extra_after_edit después:', disp_extra_after_edit);

      /**
       * Contains all `garanzie` activated during the new duration,
       * inlcuding the ones not counted in the pack itself.
       * @var Garanzie[] $gr_durante_new_pack
       */
      const gr_durante_new_pack = await manager.query(`
        SELECT * FROM garanzie 
        WHERE dealer = ?
        AND data_attivazione >= ?
        AND data_attivazione <= ?
      `, [model.dealer, model.data_attivazione, model.data_attivazione])

      /**
       * All the garanzie (as record) to be removed from their proforma.
       * Before adding to this array, set `consumo_pack` to 0 but keep the `id_proforma`,
       * as it will be used to regenerate the .pdf and recalculate the amount of the proforma
       * where the garanzia was included.
       * 
       * @var Garanzie[] $garanzie_fully_in_new_pack
       */
      const garanzie_fully_in_new_pack = [];
      /** @var Garanzie[] $soccorsi_fully_in_new_pack */
      const soccorsi_fully_in_new_pack = [];
      /** @var Garanzie[] $autosost_fully_in_new_pack */
      const autosost_fully_in_new_pack = [];

      const gr_new_pack_by_tipo = gr_durante_new_pack.reduce((acc, garanzia) => {
        const tipo = garanzia.tipo_garanzia;
        if (!acc[tipo]) {
          acc[tipo] = {};
        }
        acc[tipo][garanzia.id] = garanzia;
        return acc;
      }, {} as Record<string, Record<number, any>>);

      /**
       * Garanzie activated during the new pack's duration,
       * multi-mapped as `soccorso__km` => `id` => `Garanzia`
       * @var Garanzie[][] $gr_new_pack_by_soccorso
       */
      const gr_new_pack_by_soccorso = gr_durante_new_pack.reduce((acc, garanzia) => {
        const tipo = garanzia.soccorso__km;
        if (!acc[tipo]) {
          acc[tipo] = {};
        }
        acc[tipo][garanzia.id] = garanzia;
        return acc;
      }, {} as Record<string, Record<number, any>>);

      // Eliminar garantías con soccorso__km = 0
      delete gr_new_pack_by_soccorso['0'];

      // Filtrar garantías con auto sustitutivo
      const gr_new_pack_autosost = gr_durante_new_pack
        .filter((garanzia: Garanzia) => garanzia.soccorso__auto_sostitutiva)
        .reduce((acc, garanzia) => {
          acc[garanzia.id] = garanzia;
          return acc;
        }, {} as Record<number, Garanzia>);

      // Procesar cada tipo de garantía
      for (const [tipo_gr, garanzie_per_tipo] of Object.entries(gr_new_pack_by_tipo)) {
        let disp_residua_per_tipo = parseInt(String(disp_gr_after_edit[tipo_gr])) || 0;

        // Ordenar garantías por fecha de activación y id
        const garantiasSorted = Object.values(garanzie_per_tipo).sort((a: Garanzia, b: Garanzia) => {
          const dateComparison = new Date(a.data_attivazione).getTime() - new Date(b.data_attivazione).getTime();
          return dateComparison === 0 ? a.id - b.id : dateComparison;
        });

        // Verificar cobertura de cada garantía
        for (const garanzia of garantiasSorted) {
          // Si no hay más disponibilidad residual
          if (disp_residua_per_tipo === 0) {
            await manager.query(
              'UPDATE garanzie SET consumo_pack = ? WHERE id = ?',
              [0, garanzia.id]
            );
            garanzie_da_pagare.push(garanzia);
            continue;
          }

          const consumo_pack_gr = Math.min(
            disp_residua_per_tipo,
            parseInt(String(garanzia.durata)) / 12
          );

          await manager.query(
            'UPDATE garanzie SET consumo_pack = ? WHERE id = ?',
            [consumo_pack_gr, garanzia.id]
          );

          disp_residua_per_tipo -= consumo_pack_gr;

          if (consumo_pack_gr < parseInt(String(garanzia.durata)) / 12) {
            // Si la garantía no está completamente cubierta
            garanzie_da_pagare.push(garanzia);
          } else {
            // Si está completamente cubierta
            garanzie_fully_in_new_pack.push(garanzia);
          }
        }
      }

      // Procesar cada tipo de servicio de asistencia
      for (const [km_soccorso, garanzie_per_tipo_ss] of Object.entries(gr_new_pack_by_soccorso)) {
        const tipo_ss = id_tipi_soccorso[km_soccorso] || 0;
        if (tipo_ss === 0) continue; // This should never happen

        let disp_residua_ss_per_tipo = parseInt(String(disp_extra_after_edit[tipo_ss])) || 0;

        // Ordenar garantías por fecha de activación y id
        const garantiasSorted = Object.values(garanzie_per_tipo_ss).sort((a: Garanzia, b: Garanzia) => {
          const dateComparison = new Date(a.data_attivazione).getTime() - new Date(b.data_attivazione).getTime();
          return dateComparison === 0 ? a.id - b.id : dateComparison;
        });

        // Verificar cobertura de cada garantía
        for (const garanzia of garantiasSorted) {
          // Si no hay más disponibilidad residual
          if (disp_residua_ss_per_tipo === 0) {
            await manager.query(
              'UPDATE garanzie SET consumo_pack_soccorso = ? WHERE id = ?',
              [0, garanzia.id]
            );
            soccorsi_da_pagare.push(garanzia);
            continue;
          }

          const consumo_pack_ss = Math.min(
            disp_residua_ss_per_tipo,
            parseInt(String(garanzia.durata)) / 12
          );

          await manager.query(
            'UPDATE garanzie SET consumo_pack_soccorso = ? WHERE id = ?',
            [consumo_pack_ss, garanzia.id]
          );

          disp_residua_ss_per_tipo -= consumo_pack_ss;

          if (consumo_pack_ss < parseInt(String(garanzia.durata)) / 12) {
            // Si la garantía no está completamente cubierta
            soccorsi_da_pagare.push(garanzia);
          } else {
            // Si está completamente cubierta
            soccorsi_fully_in_new_pack.push(garanzia);
          }
        }
      }

      disp_residua_autosost = parseInt(String(disp_extra_after_edit[5])) || 0;

      // Ordenar garantías por fecha de activación y id
      const garantiasAutoSostSorted = Object.values(gr_new_pack_autosost).sort((a: Garanzia, b: Garanzia) => {
        const dateComparison = new Date(a.data_attivazione).getTime() - new Date(b.data_attivazione).getTime();
        return dateComparison === 0 ? a.id - b.id : dateComparison;
      });

      // Verificar cobertura de cada garantía con auto sustitutivo
      for (const garanzia of garantiasAutoSostSorted) {
        // Si no hay más disponibilidad residual
        if (disp_residua_autosost === 0) {
          //@ts-ignore
          await manager.query('UPDATE garanzie SET consumo_pack_autosost = ? WHERE id = ?', [0, garanzia.id]
          );
          autosost_da_pagare.push(garanzia);
          continue;
        }

        //@ts-ignore
        const consumo_pack_autosost = Math.min(disp_residua_autosost, parseInt(String(garanzia.durata)) / 12);

        //@ts-ignore
        await manager.query('UPDATE garanzie SET consumo_pack_autosost = ? WHERE id = ?', [consumo_pack_autosost, garanzia.id]
        );

        disp_residua_autosost -= consumo_pack_autosost;
        //@ts-ignore
        if (consumo_pack_autosost < parseInt(String(garanzia.durata)) / 12) {
          // Si la garantía no está completamente cubierta
          autosost_da_pagare.push(garanzia);
        } else {
          // Si está completamente cubierta
          autosost_fully_in_new_pack.push(garanzia);
        }
      }

      /**
 * Contains all the ids of the proforma to recalc
 */
      const pf_da_rigenerare: number[] = [];

      // Remove the proforma for all the garanzie fully covered by the pack
      for (const garanzia of garanzie_fully_in_new_pack) {
        pf_da_rigenerare.push(garanzia.id_proforma);
        await manager.query(
          'UPDATE garanzie SET id_proforma = ? WHERE id = ?',
          [0, garanzia.id]
        );
      }

      // Remove the proforma for all soccorsi fully covered by the pack
      for (const garanzia of soccorsi_fully_in_new_pack) {
        pf_da_rigenerare.push(garanzia.id_proforma_soccorso);
        await manager.query(
          'UPDATE garanzie SET id_proforma_soccorso = ? WHERE id = ?',
          [0, garanzia.id]
        );
      }

      // Remove the proforma for all autosost fully covered by the pack
      for (const garanzia of autosost_fully_in_new_pack) {
        pf_da_rigenerare.push(garanzia.id_proforma_autosost);
        await manager.query(
          'UPDATE garanzie SET id_proforma_autosost = ? WHERE id = ?',
          [0, garanzia.id]
        );
      }

      const [dealerr] = await manager.query('SELECT * FROM dealers WHERE id = ?', [model.dealer])

      async function setIdProforma(
        garanzie: Garanzia[],
        tipo_proforma: number,
        dealer: Dealer,
        model: any,
        prev_log_record: number,
        pf_da_rigenerare: number[]
      ): Promise<void> {
        const pf_fine_mese = !dealer.data_proforma_singole_garanzie;
        const prop_name = ['id_proforma', 'id_proforma_soccorso', 'id_proforma_autosost'][tipo_proforma];

        for (const garanzia of garanzie) {
          // Si ya tiene id_proforma, usarlo
          if (garanzia[prop_name] !== 0) {
            pf_da_rigenerare.push(garanzia[prop_name]);
            continue;
          }

          let pf_found: Proforma | null = null;

          if (pf_fine_mese) {
            // Preferencia del dealer: generar una única proforma al final del mes            
            [pf_found] = await manager.query(`
              SELECT * FROM proforma
              WHERE tipo_cliente = 0
              AND id_cliente = ?
              AND tipo_proforma = 0
              AND data_proforma = ?
              AND is_deleted = false
            `, [
              model.dealer,
              //@ts-ignore
              format(new Date(garanzia.data_inserimento), 'yyyy-MM-t')
            ])

            // Si no hay proforma para fin de mes, crear una
            if (!pf_found) {
              const newProforma: Proforma = {
                tipo_cliente: 0,
                id_cliente: model.dealer,
                agente: dealerr.agente,
                tipo_proforma: 0,
                importo: 0,
                data_inserimento: format(new Date(), 'yyyy-MM-dd'),
                data_invio: '1900-01-01',
                //@ts-ignore
                data_proforma: format(new Date(garanzia.data_inserimento), 'yyyy-MM-t'),
                pagamento__rate: dealerr.pagamento__rate,
                pagamento__differita: dealerr.pagamento__differita,
                pagamento__periodo: dealerr.pagamento__periodo,
                is_deleted: false
              };

              const result = await manager.query(
                'INSERT INTO proforma SET ?',
                [newProforma]
              );
              console.log('result.insertId___ ', result.insertId)
              pf_found = { ...newProforma, id: result.insertId };

              // await logOperation({
              //   operazione: 1,
              //   record_table: 'proforma',
              //   record_id: pf_found.id,
              //   newVal: pf_found,
              //   cascade_from: prev_log_record,
              // });
            }
          } else {
            // Preferencia del dealer: generar una proforma por garantía
            let id_pf_found = 0;
            if (prop_name !== 'id_proforma') {
              //@ts-ignore
              id_pf_found = garanzia.id_proforma;
              //@ts-ignore
              if (id_pf_found === 0) id_pf_found = garanzia.id_proforma_soccorso;
              //@ts-ignore
              if (id_pf_found === 0) id_pf_found = garanzia.id_proforma_autosost;

              if (id_pf_found !== 0) {

                pf_found = await manager.query('SELECT * FROM proforma WHERE id = ? ', [id_pf_found])
              }
            }

            if (!pf_found) {
              const newProforma: Proforma = {
                tipo_cliente: 0,
                id_cliente: model.dealer,
                agente: dealerr.agente,
                tipo_proforma: 0,
                importo: 0,
                data_inserimento: format(new Date(), 'yyyy-MM-dd'),
                //@ts-ignore
                data_proforma: format(new Date(garanzia.data_inserimento), 'yyyy-MM-dd'),
                data_invio: '1900-01-01',
                pagamento__rate: dealerr.pagamento__rate,
                pagamento__differita: dealerr.pagamento__differita,
                pagamento__periodo: dealerr.pagamento__periodo,
                is_deleted: false
              };

              const result = await manager.query(
                'INSERT INTO proforma SET ?',
                [newProforma]
              );
              console.log('result:::___', result)
              console.log('pf_found___ ', result.insertId)
              pf_found = { ...newProforma, id: result.insertId };

              // await logOperation({
              //   operazione: 1,
              //   record_table: 'proforma',
              //   record_id: pf_found.id,
              //   newVal: pf_found,
              //   cascade_from: prev_log_record,
              // });
            }
          }
          console.log('pf_found.id___ ', pf_found)
          pf_da_rigenerare.push(pf_found.id);
          await manager.query(
            `UPDATE garanzie SET ${prop_name} = ? WHERE id = ?`,
            [pf_found.id, garanzia.id]
          );

          // await logOperation({
          //   operazione: 2,
          //   record_table: 'garanzie',
          //   record_id: garanzia.id,
          //   newVal: garanzia,
          //   cascade_from: prev_log_record,
          // });
        }
      }

      await setIdProforma(garanzie_da_pagare, 0, model.dealer, model, 0, pf_da_rigenerare);
      await setIdProforma(soccorsi_da_pagare, 1, model.dealer, model, 0, pf_da_rigenerare);
      await setIdProforma(autosost_da_pagare, 2, model.dealer, model, 0, pf_da_rigenerare);

      // Recalcular y regenerar proforma asociada al pack
      pf_da_rigenerare.push(model.id_proforma);

      // Actualizar fecha de proforma e instalaciones desde el pack
      let data_pf = '';
      if (model.data_attivazione !== format(new Date(), 'yyyy-MM-dd')) {
        data_pf = model.data_attivazione;
      } else {
        data_pf = model.pagamento__data ? format(new Date(), 'yyyy-MM-t') : format(new Date(), 'yyyy-MM-dd');
      }

      // Actualizar proforma
      if (model.id_proforma) {
        await manager.query(
          'UPDATE proforma SET data_proforma = ?, pagamento__rate = ?, pagamento__differita = ?, pagamento__periodo = ? WHERE id = ?',
          [data_pf, model.rate, model.prima_rata, model.periodo, model.id_proforma]
        );
      }

      // Regenerar todas las proformas que necesitan recálculo
      const uniqueProformas = [...new Set(pf_da_rigenerare)];
      await manager.query('COMMIT')
      console.log('uniqueProformas___ ', uniqueProformas)
      for (const id_proforma_regen of uniqueProformas) {
        if (id_proforma_regen === 0) continue;
        await this.proformaService.recalcTotaleProforma(id_proforma_regen);
        await this.proformaService.genPdfProforma(id_proforma_regen);
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
    const validFields = Object.keys(search).filter(key => !['page', 'limit', 'sort', 'order'].includes(key));

    validFields.forEach(key => {
      const value = search[key];
      if (value !== undefined && value !== null && value !== '') {

        if (value && key === 'data_inserimento' || key === 'data_attivazione' || key === 'data_scadenza') {
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




        if (typeof value === 'string' && key !== 'data_inserimento' && key !== 'data_attivazione' && key !== 'data_scadenza') {
          query.andWhere(`op.${key} LIKE :${key}`, { [key]: `%${value}%` });
        } else if (typeof value === 'number') {
          query.andWhere(`op.${key} = :${key}`, { [key]: value });
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
