import { BadRequestException, ForbiddenException, forwardRef, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { CreateProformaDto } from './dto/create-proforma.dto';
import { UpdateProformaDto } from './dto/update-proforma.dto';
import { DataSource, EntityManager, SelectQueryBuilder } from 'typeorm';
import { InjectDataSource, InjectEntityManager } from '@nestjs/typeorm';
import { OrdiniContrConsumoCardsService } from 'src/modules/ordini/ordini-contr-consumo-cards/ordini-contr-consumo-cards.service';
import { ProformaSearch } from './interface/proforma.types';
import { UsersService } from 'src/modules/users/users.service';
import { User } from 'src/interfaces/interfaces';
import { format } from 'date-fns';
import { MailService } from 'src/mail/mail.service';
import { OrdiniContrConsumoService } from 'src/modules/ordini/ordini-contr-consumo/ordini-contr-consumo.service';
import { GenPdfService } from 'src/modules/gen-pdf/gen-pdf.service';


export const ProformaSearchCardKeys = [
  'id',
  'data_proforma',
  'tipo_cliente',
  'id_cliente',
  'nome_clienti',
  'agente',
  'tipo_proforma',
  'incasso',
  'saldo'
]
@Injectable()
export class ProformaService {
  totale_pf = 0
  ordini: any;

  constructor(

    @InjectEntityManager() private entityManager: EntityManager,

    @InjectDataSource() private dataSource: DataSource,

    private usersService: UsersService,

    @Inject(forwardRef(() => MailService))
    private readonly mailService: MailService,

    @Inject(forwardRef(() => OrdiniContrConsumoCardsService))
    private ordiniContrConsumoCardsService: OrdiniContrConsumoCardsService,

    @Inject(forwardRef(() => OrdiniContrConsumoService))
    private readonly ordiniContrConsumoService: OrdiniContrConsumoService,

    private readonly genPdfService: GenPdfService

  ) { }



  async create(createProformaDto: any) {

    const proformaId = await this.dataSource.transaction(async (manager) => {
      const model = createProformaDto;

      // Actualizar cliente y crear proforma en una sola transacción
      if (model.tipo_cliente === 1) {
        await manager
          .createQueryBuilder()
          .update('clienti')
          .set({ abilitazione_proforma: true })
          .where('id = :id', { id: model.id_cliente })
          .execute();
      }

      // Preparar proforma sin filas
      //@ts-ignore
      const { rows, ...modelWithoutRows } = {
        ...model,
        tipo_proforma: 5,
        data_inserimento: new Date(),
        data_invio: '1900-01-01',
        data_proforma: new Date(),
        pagamento__rate: 1,
        pagamento__periodo: 30,
        pagamento__differita: 30,
        is_deleted: false,
        importo: 0
      };

      // Insertar proforma
      const pf_found = await manager
        .createQueryBuilder()
        .insert()
        .into('proforma')
        .values(modelWithoutRows)
        .execute();

      const proformaId = pf_found.raw?.insertId;

      // Insertar todas las filas en una sola operación en lugar de múltiples operaciones individuales
      if (proformaId && rows?.length > 0) {
        const rowsWithProformaId = rows.map(row => ({
          ...row,
          proforma: proformaId,
          is_deleted: false
        }));

        await manager
          .createQueryBuilder()
          .insert()
          .into('proforma__liberi_rows')
          .values(rowsWithProformaId)
          .execute();
      }

      // Recalcular y generar PDF después de la transacción      
      return proformaId;
    });

    await this.recalcTotaleProforma(proformaId);
    await this.genPdfProforma(proformaId);
  }

  async getProforma(
    search: ProformaSearch = {},
    page: number = 1,
    limit: number = 20,
    sort: string = 'id',
    order: 'DESC' | 'ASC' = 'DESC'
  ): Promise<{
    proforma: any[], total: number, importo_total: number, incaso_total: number, saldo_total: number
  }> {
    page = Math.max(1, Number(page));
    limit = Math.max(1, Math.min(50, Number(limit)));
    const validOrder = ['ASC', 'DESC'].includes(order) ? order : 'DESC';
    const sortColumn = ProformaSearchCardKeys.includes(sort) ? sort : 'id';

    const query = this.entityManager.createQueryBuilder()
      .select('vp.*')
      .from('v_proforma', 'vp')
      .where('vp.is_deleted = 0');
    this.applyFilters(query, search);


    const totalQueryBuilder = query.clone();
    const totalResult = await totalQueryBuilder.select('COUNT(*)', 'total').getRawOne();
    const total = Number(totalResult?.total) || 0;
    const importoResult = await totalQueryBuilder.select('SUM(vp.importo) as importo_total, SUM(vp.incasso) as incaso_total, SUM(vp.saldo) as saldo_total').getRawOne();
    const importo_total = Number(importoResult?.importo_total || 0);
    const incaso_total = Number(importoResult?.incaso_total || 0)
    const saldo_total = Number(importoResult?.saldo_total || 0)
    // Aplicar ordenación y paginación
    query
      .orderBy(`vp.${sortColumn}`, validOrder as 'DESC' | 'ASC')
      .offset((page - 1) * limit)
      .limit(limit);

    const proforma = await query.getRawMany();
    // Fetch products for each order
    // Fetch products for each order
    const profWithfact = await Promise.all(proforma.map(async (pr) => {
      const faturre = await this.dataSource
        .createQueryBuilder()
        .select('f.*')
        .from('fatture', 'f')
        .where('f.rif_proforma = :rif_proforma', { rif_proforma: pr.id })
        .getRawMany();

      return {
        ...pr,
        faturre
      };
    }));


    return { proforma: profWithfact, total, importo_total, incaso_total, saldo_total };
  }

  async findOne(id: number) {

    const [result] = await this.dataSource.query(
      `SELECT * FROM proforma WHERE id = ?`,
      [id]
    );

    const rows = await this.dataSource.query('SELECT * FROM proforma__liberi_rows WHERE proforma = ? AND is_deleted = false', [id]);

    return { ...result, rows };
  }

  async update(id: number, updateProformaDto: any) {
    return await this.dataSource.transaction(async (manager) => {

      const request = updateProformaDto;

      const { rows, ...modelWithoutRows } = request

      await manager
        .createQueryBuilder()
        .update('proforma__liberi_rows')
        .set({ is_deleted: true })
        .where('proforma = :id', { id })
        .execute();

      for (let row of rows) {
        // row.proforma =
        delete row.id
        row.is_deleted = false
        row.proforma = id
        await manager
          .createQueryBuilder()
          .insert()
          .into('proforma__liberi_rows')
          .values(
            row
          )
          .execute();
      }

      await manager
        .createQueryBuilder()
        .update('proforma')
        .set({
          ...modelWithoutRows
        })
        .where('id = :id', { id })
        .execute();
      manager.query('COMMIT;')
      await this.recalcTotaleProforma(id)
      await this.genPdfProforma(id)
    })
  }

  async removeLiberti(id: number) {
    return await this.dataSource.transaction(async (manager) => {




      const model = this.findOne(id);

      if (!model) {
        throw new NotFoundException('Proforma non trovato.');
      }

      await manager
        .createQueryBuilder()
        .update('proforma__liberi_rows')
        .set({ is_deleted: true })
        .where('id = :id', { id })
        .execute();

    })
  }

  async remove(id: number) {
    return await this.dataSource.transaction(async (manager) => {




      const [proforma] = await manager.query('SELECT * FROM proforma WHERE id = ?', [id])
      console.log('proforma__ ', proforma)
      await manager
        .createQueryBuilder()
        .update('proforma')
        .set({ is_deleted: true })
        .where('id = :id', { id })
        .execute();

      if (proforma.tipo_proforma === 1) {
        await manager
          .createQueryBuilder()
          .update('ordini__pacchetti')
          .set({ id_proforma: 0 })
          .where('id_proforma = :id_proforma', { id })
          .execute();
      }

      if (proforma.tipo_proforma === 3) {
        await manager
          .createQueryBuilder()
          .update('ordini__pacchetti_cardss')
          .set({ id_proforma: 0 })
          .where('id_proforma = :id_proforma', { id })
          .execute();
      }

      const log = {
        operazione: 3,
        record_table: 'proforma',
        record_id: id
      }

      await manager
        .createQueryBuilder()
        .insert()
        .into('log')
        .values(
          log
        )
        .execute();

    })
  }

  async actionFinalizzaProforma(id: number) {
    return await this.dataSource.transaction(async (manager) => {




      await manager
        .createQueryBuilder()
        .update('proforma')
        .set({ data_proforma: format(new Date(), 'yyyy-MM-dd') })
        .where('id = :id', { id: id })
        .execute();

      const log = {
        operazione: 2,
        record_table: 'proforma',
        record_id: id
      }

      await manager
        .createQueryBuilder()
        .insert()
        .into('log')
        .values(
          log
        )
        .execute();

    })
  }

  async recalcTotaleProforma(id: number) {

    return await this.dataSource.transaction(async (manager) => {

      const [value] = await manager.query(
        'SELECT id, tipo_proforma, abbonamento__id FROM proforma WHERE id = ?',
        [id]
      );
      const model = value

      if (!model) {
        throw new NotFoundException('Proforma non trovato.');
      }

      switch (model.tipo_proforma) {
        case 0: // Garanzie

          const garanzie = await manager.query('SELECT * FROM garanzie WHERE id_proforma = ?', [model.id])
          const soccorsi = await manager.query('SELECT * FROM garanzie WHERE id_proforma_soccorso = ?', [model.id])

          const autosost = await manager.query('SELECT * FROM garanzie WHERE id_proforma_autosost = ?', [model.id])
          let total = 0;
          try {
            const prices = await Promise.all(
              garanzie.map(async (garanzia) => {

                const quantita = Math.max(0, (parseInt(garanzia.durata || '0') / 12) - parseInt(garanzia.consumo_pack || '0'));

                const prezzo = await this.ordiniContrConsumoCardsService.getPrezzoGaranzia(
                  garanzia.dealer,
                  garanzia.tipo_garanzia,
                  garanzia.data_attivazione
                );

                // Ensure prezzo is a valid number
                const prezzoValue = Number(prezzo);

                if (isNaN(prezzoValue)) {
                  console.error('Invalid price for garanzia:', garanzia);
                  return 0;
                }

                return prezzoValue * Number(quantita);

              })
            );

            total = prices.reduce((a, b) => a + b, 0);

          } catch (error) {
            console.error('Total calculation error:', error);
          }

          const _prezzi_default_soccorsi = {
            40: 20,
            60: 25,
            100: 30
          };

          if (soccorsi.length > 0) {
            total += await (async () => {
              const prices = await Promise.all(
                soccorsi.map(async (garanzia_soccorso) => {
                  const queryResult = await this.entityManager
                    .createQueryBuilder()
                    .select(`occ.soccorso_${garanzia_soccorso.soccorso__km}km`, 'prezzo')
                    .from('ordini__contratti_a_consumo', 'occ')
                    .where('occ.dealer = :dealer', { dealer: garanzia_soccorso.dealer })
                    .andWhere(':date BETWEEN occ.data_inizio_contratto AND occ.data_fine_contratto', {
                      date: garanzia_soccorso.data_attivazione
                    })
                    .getRawOne();

                  const prezzo = queryResult?.prezzo ?? _prezzi_default_soccorsi[garanzia_soccorso.soccorso__km];
                  const quantita = Math.max(0, (parseInt(garanzia_soccorso.durata) / 12) - parseInt(garanzia_soccorso.consumo_pack_soccorso));

                  return prezzo * quantita;
                })
              );

              return prices.reduce((a, b) => a + b, 0);
            })();
          }

          if (autosost.length > 0) {
            total += await (async () => {
              const prices = await Promise.all(
                autosost.map(async (gr_auto) => {
                  const queryResult = await this.entityManager
                    .createQueryBuilder()
                    .select('occ.auto_sost', 'prezzo')
                    .from('ordini__contratti_a_consumo', 'occ')
                    .where('occ.dealer = :dealer', { dealer: gr_auto.dealer })
                    .andWhere('CURRENT_TIMESTAMP BETWEEN occ.data_inizio_contratto AND occ.data_fine_contratto')
                    .getRawOne();


                  const prezzo = queryResult?.prezzo ?? 10;

                  const quantita = Math.max(0, (parseInt(gr_auto.durata) / 12) - parseInt(gr_auto.consumo_pack_autosost));


                  return prezzo * quantita;
                })
              );

              return prices.reduce((a, b) => a + b, 0);
            })();
          }

          await this.entityManager
            .createQueryBuilder()
            .update('proforma')
            .set({
              importo: total.toFixed(2)
            })
            .where('id = :id', { id })
            .execute();
          break;
        case 1: // Pack Garanzie
          this.ordini = await manager.query('SELECT * FROM ordini__pacchetti WHERE id_proforma = ? LIMIT 1', [model.id])

          // Per ogni ordine di un pacchetto viene genereata una Proforma separata
          if (!this.ordini) {
            await this.entityManager
              .createQueryBuilder()
              .update('proforma')
              .set({
                is_deleted: true
              })
              .where('id = :id', { id })
              .execute();
          }

          const ordine_rows = await manager.query('SELECT * FROM ordini__prodotti_quantita WHERE ordine = ?', [this.ordini.id])
          this.ordini = undefined;

          const totalePf = ordine_rows.reduce((total, row) => {
            const netto = parseFloat(row.prezzoNetto);
            return total + (netto * parseInt(row.quantita));
          }, 0);

          await this.entityManager
            .createQueryBuilder()
            .update('proforma')
            .set({
              importo: totalePf.toFixed(2)
            })
            .where('id = :id', { id })
            .execute();

          break;
        case 2:
          const cardss = await manager.query('SELECT * FROM card_soccorso_2 WHERE id_proforma = ?', [model.id])

          const restituzioni = await manager.query('SELECT * FROM card_soccorso_2 WHERE id_proforma_restituzione = ?', [model.id])

          for (let card of cardss) {
            this.totale_pf += await this.ordiniContrConsumoCardsService.getPrezzoSoccorso(card.dealer, card.tipo_card, card.data_attivazione);
          }

          const tipi_restituzione = { 1: 'RR', 2: 'RN' };
          for (let card_rest of restituzioni) {
            this.totale_pf += await this.ordiniContrConsumoCardsService.getPrezzoSoccorso(card_rest.dealer, tipi_restituzione[card_rest.restituzione], card_rest.data_attivazione);
          }

          await this.entityManager
            .createQueryBuilder()
            .update('proforma')
            .set({
              importo: this.totale_pf
            })
            .where('id = :id', { id })
            .execute();

          break;
        case 3:
          this.ordini = await manager.query('SELECT * FROM ordini__pacchetti_cardss WHERE id_proforma = ?', [model.id]);
          const ordine_quantita = await manager.query('SELECT * FROM ordini__pacchetti_cardss_quantita WHERE ordine = ?', [model.id])

          // Per ogni ordine di un pacchetto viene genereata una Proforma separata
          let totale_pf = 0.0;
          delete this.ordini;

          totale_pf = ordine_quantita.reduce((acc, row) =>
            acc + Number(row.prezzo_netto) * Number(row.quantita), 0);

          await this.entityManager
            .createQueryBuilder()
            .update('proforma')
            .set({
              importo: totale_pf.toFixed(2)
            })
            .where('id = :id', { id })
            .execute();

          break;
        case 4: // Abbonamenti Garanzie          
          const [abbonamento] = await manager.query(`
            SELECT ddc_prz, gest_prz, ddc_qta, gest_qta FROM ordini__abbonamenti_garanzie WHERE id = ?`
            , [model.abbonamento__id])

          const ddc_prz = Number(abbonamento.ddc_prz) || 0;
          const gest_prz = Number(abbonamento.gest_prz) || 0;
          const ddc_qta = Number(abbonamento.ddc_qta) || 0;
          const gest_qta = Number(abbonamento.gest_qta) || 0;

          let value = 0
          if (ddc_qta !== 0) {
            console.log(Number(ddc_prz.toFixed(2)))
            value += Number(ddc_prz)
          }
          if (gest_qta !== 0) {
            value += Number(gest_prz)
          }

          await this.entityManager
            .createQueryBuilder()
            .update('proforma')
            .set({
              importo: value
            })
            .where('id = :id', { id })
            .execute();

          break;
        case 5: // Libere

          await manager.query(`
          UPDATE proforma p 
          SET p.importo = (
            SELECT ROUND(SUM(prezzo_unitario * quantita), 2) 
            FROM proforma__liberi_rows 
            WHERE proforma = ? AND is_deleted = false
          )
          WHERE p.id = ?
        `, [model.id, id]);
          break;
        case 10: // Garanzie - import
        case 11: // Pack Garanzie import
        case 12: // Card Ss import
        case 13: // Pack Card Ss import
        case 14: // Abbonamenti import
        case 15: // Libere import

          const rowss = await manager.query('SELECT * FROM proforma__imported_rows WHERE proforma = ?', [model.id])
          totale_pf = rowss.reduce((acc, row) =>
            acc + Number(row.prezzo_unitario) * Number(row.quantita), 0);


          await this.entityManager
            .createQueryBuilder()
            .update('proforma')
            .set({
              importo: totale_pf.toFixed(2)
            })
            .where('id = :id', { id })
            .execute();
        default:
          console.log('Tipo proforma sconosciuto: ', model.tipo_proforma);
      }
    })

  }



  applyFilters(query: SelectQueryBuilder<any>, search: ProformaSearch): void {
    // Lista de campos válidos para filtrar (excluyendo page y limit)
    const validFields = Object.keys(search).filter(key => !['page', 'limit', 'sort', 'order'].includes(key));
    console.log(validFields)
    validFields.forEach(key => {
      console.log(key)
      const value = search[key];
      if (value !== undefined && value !== null && value !== '') {

        if (value && key === 'data_proforma') {
          const newValue = JSON.parse(value)

          const fromDate = newValue.from;
          const toDate = newValue.to;
          query.andWhere(
            `DATE(vp.${key}) BETWEEN :${key}From AND :${key}To`,
            {
              [`${key}From`]: fromDate,
              [`${key}To`]: toDate
            }
          )
        }

        if (key === 'saldo' && value) {

          if (value == "Saldato") {
            query.andWhere(`vp.${key} = :${key}`, { [key]: 0 });
          } else {
            query.andWhere(`vp.${key} >= :${key}`, { [key]: 1 });
          }
        }

        if (typeof value === 'string' && key !== 'data_proforma' && key !== 'saldo') {
          query.andWhere(`vp.${key} LIKE :${key}`, { [key]: `%${value}%` });
        } else if (typeof value === 'number') {
          query.andWhere(`vp.${key} = :${key}`, { [key]: value });
        }
      }
    });
  }


  async actionInviaProforma(id: any) {


    const [proforma] = await this.entityManager.query('SELECT * FROM proforma WHERE id = ?', [id.id]);
    let to = '';
    let cc = [];
    let subject = '';
    console.log('proforma___ ', proforma)
    switch (proforma.tipo_proforma) {
      case 0: // Dealer
        console.log('0')
        const [dealer] = await this.entityManager.query('SELECT denominazione FROM dealers WHERE id = ?', [proforma.id_cliente])
        console.log('dealer::: ', dealer)
        subject = `Invio Proforma: Dealer ${dealer.denominazione}`
        const contatti = await this.entityManager.query('SELECT * FROM dealers__contatti WHERE dealer = ?', [proforma.id_cliente])
        const [agenti] = await this.entityManager.query('SELECT email FROM agenti WHERE id = ?', [proforma.id_cliente])

        if (agenti) cc.push(agenti.email);
        contatti.slice(1, 3).forEach(contatto => {
          const email = contatto?.email;
          if (email) cc.push(email);
        });
        break;
      case 1: // Dealer
        console.log('1')
        const [cliente] = await this.entityManager.query('SELECT * FROM clienti WHERE id = ? ', [proforma.id_cliente])
        if (!cliente) throw new BadRequestException('La risorsa richiesta non è stata trovata.');
        to = cliente.email
        subject = `Invio Proforma: Cliente ${cliente.denominazione}`
        if (to === '') throw new BadRequestException('Email cliente non fornita.');
        if (cliente.agente !== 0) {
          const [agenti] = await this.entityManager.query('SELECT email FROM agenti WHERE id = ?', [proforma.id_cliente])
          if (agenti) cc.push(agenti.email);
        }
        break;
      default:
        throw new NotFoundException('La risorsa richiesta non è stata trovata.');
    }
    const solleciti = proforma.date_invii_successivi.split('|');
    const num_solleciti = proforma.date_invii_successivi === 0 ? 0 : solleciti.length
    const template = proforma.data_invio === '1900-01-01' ? 'invio' : `sollecito_${Math.min(3, num_solleciti + 1)}`
    const data_proforma = format(new Date(proforma.data_proforma), 'dd/MM/yyyy');

    console.log('Enviando correo....')
    await this.mailService.sendProformaEmail('aetiru@gmail.com', 'aetiru@gmail.com', 'aetiru@gmail.com', proforma.id, solleciti, data_proforma, subject, template)

    if (format(new Date(proforma.data_invio), 'yyyy-MM-dd') === '1900-01-01') {
      await this.entityManager
        .createQueryBuilder()
        .update('proforma')
        .set({ data_invio: format(new Date(), 'yyyy-MM-dd') })
        .where('id = :id', { id: id.id })
        .execute();
    } else {
      if (proforma.date_invii_successivi === '') {
        await this.entityManager
          .createQueryBuilder()
          .update('proforma')
          .set({ date_invii_successivi: format(new Date(), 'yyyy-MM-dd') })
          .where('id = :id', { id: id.id })
          .execute();
      } else if (proforma.date_invii_successivi.length < 32) {
        // Al massimo 3 solleciti vengono salvati: 10 caratteri per data (yyyy-mm-dd) + 2 separatori
        await this.entityManager
          .createQueryBuilder()
          .update('proforma')
          .set({ date_invii_successivi: `${proforma.date_invii_successivi} | ${format(new Date(), 'yyyy-MM-dd')}` })
          .where('id = :id', { id: id.id })
          .execute();
      }
    }

  }

  async actionNotificaSelezionati(sel: any) {


    for (let id of sel) {

      const [proforma] = await this.entityManager.query('SELECT * FROM proforma WHERE id = ?', [id]);
      let to = '';
      let cc = [];
      let subject = '';
      console.log('proforma___ ', proforma)
      switch (proforma.tipo_proforma) {
        case 0: // Dealer
          console.log('0')
          const [dealer] = await this.entityManager.query('SELECT denominazione FROM dealers WHERE id = ?', [proforma.id_cliente])
          console.log('dealer::: ', dealer)
          subject = `Invio Proforma: Dealer ${dealer.denominazione}`
          const contatti = await this.entityManager.query('SELECT * FROM dealers__contatti WHERE dealer = ?', [proforma.id_cliente])
          const [agenti] = await this.entityManager.query('SELECT email FROM agenti WHERE id = ?', [proforma.id_cliente])

          if (agenti) cc.push(agenti.email);
          contatti.slice(1, 3).forEach(contatto => {
            const email = contatto?.email;
            if (email) cc.push(email);
          });
          break;
        case 1: // Dealer
          console.log('1')
          const [cliente] = await this.entityManager.query('SELECT * FROM clienti WHERE id = ? ', [proforma.id_cliente])
          if (!cliente) throw new BadRequestException('La risorsa richiesta non è stata trovata.');
          to = cliente.email
          subject = `Invio Proforma: Cliente ${cliente.denominazione}`
          if (to === '') throw new BadRequestException('Email cliente non fornita.');
          if (cliente.agente !== 0) {
            const [agenti] = await this.entityManager.query('SELECT email FROM agenti WHERE id = ?', [proforma.id_cliente])
            if (agenti) cc.push(agenti.email);
          }
          break;
        default:
          throw new NotFoundException('La risorsa richiesta non è stata trovata.');
      }
      const solleciti = proforma.date_invii_successivi.split('|');
      const num_solleciti = proforma.date_invii_successivi === 0 ? 0 : solleciti.length
      const template = proforma.data_invio === '1900-01-01' ? 'invio' : `sollecito_${Math.min(3, num_solleciti + 1)}`
      const data_proforma = format(new Date(proforma.data_proforma), 'dd/MM/yyyy');

      console.log('Enviando correo....')
      await this.mailService.sendProformaEmail('aetiru@gmail.com', 'aetiru@gmail.com', 'aetiru@gmail.com', proforma.id, solleciti, data_proforma, subject, template)

      if (format(new Date(proforma.data_invio), 'yyyy-MM-dd') === '1900-01-01') {
        await this.entityManager
          .createQueryBuilder()
          .update('proforma')
          .set({ data_invio: format(new Date(), 'yyyy-MM-dd') })
          .where('id = :id', { id: id })
          .execute();
      } else {
        if (proforma.date_invii_successivi === '') {
          await this.entityManager
            .createQueryBuilder()
            .update('proforma')
            .set({ date_invii_successivi: format(new Date(), 'yyyy-MM-dd') })
            .where('id = :id', { id: id })
            .execute();
        } else if (proforma.date_invii_successivi.length < 32) {
          // Al massimo 3 solleciti vengono salvati: 10 caratteri per data (yyyy-mm-dd) + 2 separatori
          await this.entityManager
            .createQueryBuilder()
            .update('proforma')
            .set({ date_invii_successivi: `${proforma.date_invii_successivi} | ${format(new Date(), 'yyyy-MM-dd')}` })
            .where('id = :id', { id: id })
            .execute();
        }
      }
    }

  }

  async genPdfProforma(id: any) {
    // Obtener datos de proforma con una consulta única
    const [model] = await this.entityManager.query('SELECT * FROM proforma WHERE id = ?', [id]);

    if (!model) {
      throw new NotFoundException('Proforma non trovato.');
    }

    // Verificar si el importe es cero y actualizar el estado si es necesario
    if (model.importo === '0.00' || model.importo === '0') {
      await this.entityManager
        .createQueryBuilder()
        .update('fatture')
        .set({ is_deleted: true })
        .where('id = :id', { id })
        .execute();
    }

    // Determinar qué tabla consultar basada en el tipo de cliente
    let tableName, errorPrefix;
    switch (model.tipo_cliente) {
      case 0:
        tableName = 'dealers';
        errorPrefix = 'Dealer';
        break;
      case 1:
        tableName = 'clienti';
        errorPrefix = 'Cliente';
        break;
      case 2:
        tableName = 'centri_convenzionati';
        errorPrefix = 'Officina';
        break;
      default:
        throw new NotFoundException('Tipo cliente sconosciuto (' + model.tipo_cliente + ')');
    }

    // Realizar una única consulta JOIN para obtener cliente y ciudad
    const [clienteData] = await this.entityManager.query(`
    SELECT c.denominazione, c.indirizzo, c.civico, c.cap, 
           com.citta, com.provincia
    FROM ${tableName} c
    JOIN comuni com ON c.comune = com.id
    WHERE c.id = ?
  `, [model.id_cliente]);

    if (!clienteData) {
      throw new NotFoundException(`${errorPrefix} non trovato (${model.id_cliente})`);
    }

    // Estructurar datos del cliente
    const cliente = {
      rag_sociale: clienteData.denominazione,
      indirizzo: clienteData.indirizzo,
      civico: clienteData.civico,
      cap: clienteData.cap,
      citta: clienteData.citta,
      provincia: clienteData.provincia
    };

    // Generar cuerpo de proforma y PDF
    const proforma = await this.createCorpoProforma(model, true);
    const pdfBuffer = await this.genPdfService.generatePdf('proforma.template', { cliente, proforma });

    return pdfBuffer;
  }

  private validateUser(email: string): Promise<User | any> {

    const user = this.usersService.findByUsername(email)

    if (!user) throw new NotFoundException('Usuario no encontrado');

    return user;
  }

  async createCorpoProforma(model, bold_text = false) {
    const corpo_proforma = {
      'id': model.id,
      'data': format(new Date(model.data_proforma), 'dd/MM/yyyy'),
      'corpo': [],
      'imponibile': 0.0,
      'total': 0.0,
      'scadenze': model.pagamento__rate,
      'periodo': model.pagamento__periodo,
      'differita': model.pagamento__differita
    };

    console.log('model__;:;:; ', model)
    switch (model.tipo_proforma) {
      case 0: // Garanzie
        // PF Garanzie
        const garanzie = await this.entityManager.query('SELECT * FROM garanzie WHERE id_proforma = ?', [model.id])
        console.log('garanzie___ ', garanzie)
        let consumo_effettivo
        for (let garanzia of garanzie) {
          const [targa] = await this.entityManager.query('SELECT targa FROM veicoli WHERE id = ?', [garanzia.veicolo])
          const prezzo = await this.ordiniContrConsumoCardsService.getPrezzoGaranzia(garanzia.dealer, garanzia.tipo_garanzia, garanzia.data_attivazione)

          const prezzo_singolo_formatted = Number(prezzo).toFixed(2).replace('.', ',');
          const consumo_effectivo = (parseInt(garanzia.durata) / 12);
          const quantita = consumo_effectivo - parseInt(garanzia.consumo_pack);
          const prezzo_formatted = Number(prezzo * quantita).toFixed(2).replace('.', ',');
          const [tipi] = await this.entityManager.query('SELECT denominazione FROM tipi_garanzie WHERE id = ?', [garanzia.tipo_garanzia])
          if ((prezzo * quantita) > 0) {
            corpo_proforma.corpo.push({
              'descrizione': (bold_text ? `<b>${targa.targa}</b>: ` : `${targa.targa}: `) + tipi.denominazione,
              'quantita': quantita,
              'prezzo_unitario_orig': prezzo,
              'prezzo_unitario': prezzo_singolo_formatted,
              'totale': prezzo_formatted,
              'totale_orig': prezzo * quantita
            });
            corpo_proforma.imponibile += parseFloat(Number(prezzo * quantita).toFixed(2).replace(',', '.'));
          }
        }

        const soccorsi = await this.entityManager.query('SELECT * FROM garanzie WHERE id_proforma_soccorso = ?', [model.id])

        for (let garanzia_soccorso of soccorsi) {
          const [targa] = await this.entityManager.query('SELECT targa FROM veicoli WHERE id = ?', [garanzia_soccorso.veicolo])
          const prezziDefaultSoccorsi: { [key: number]: number } = {
            40: 20,
            60: 25,
            100: 30
          };

          const prezzo_singolo = await this.ordiniContrConsumoService.getPrezzoGaranzia(garanzia_soccorso.dealer, garanzia_soccorso.data_attivazione, garanzia_soccorso.soccorso__km, prezziDefaultSoccorsi[garanzia_soccorso.soccorso__km]);


          const prezzo_singolo_formatted = Number(prezzo_singolo).toFixed(2).replace('.', ',');

          consumo_effettivo = (Number(garanzia_soccorso.durata) / 12);
          const qta_soccorso = consumo_effettivo - parseInt(garanzia_soccorso.consumo_pack_soccorso);
          const prezzo_soccorso = prezzo_singolo * qta_soccorso;
          const prezzo_formatted = Number(prezzo_soccorso).toFixed(2).replace('.', ',');

          if (prezzo_formatted !== '0,00') {
            corpo_proforma.corpo.push({
              'descrizione': (bold_text ? `<br> ${targa} </b>:` : `${targa}: `) + 'Soccorso stradale' + garanzia_soccorso.soccorso__km + 'km',
              'quantita': qta_soccorso,
              'prezzo_unitario_orig': Math.round(prezzo_singolo),
              'prezzo_unitario': prezzo_singolo_formatted,
              'totale': prezzo_formatted,
              'totale_orig': Math.round(prezzo_soccorso)
            });
            corpo_proforma.imponibile += prezzo_soccorso;
          }
        }

        const autosost = await this.entityManager.query('SELECT * FROM garanzie WHERE id_proforma_autosost = ?', [model.id])

        for (let gr_autosost of autosost) {
          const targa = await this.entityManager.query('SELECT targa FROM veicoli WHERE id = ?', [gr_autosost.veicolo])
          const prezzo_autosost = await this.entityManager.query(`
            SELECT * FROM ordini__contratti_a_consumo ocac
            WHERE ocac.dealer = ?
            AND NOW() BETWEEN ocac.data_inizio_contratto AND ocac.data_fine_contratto
            LIMIT 1
          `, [gr_autosost.dealer]);

          const prezzo_formatted = Number(prezzo_autosost).toFixed(2).replace('.', ',');
          const qta_autosost = consumo_effettivo - Number(garanzie.consumo_pack_autosost)

          if (prezzo_formatted !== '0,00') {
            corpo_proforma.corpo.push({
              'descrizione': (bold_text ? `<br> ${targa} </b>:` : `${targa}: `) + 'Auto Sostitutiva',
              'quantita': qta_autosost,
              'prezzo_unitario_orig': prezzo_autosost,
              'prezzo_unitario': prezzo_formatted,
              'totale': prezzo_formatted,
              'totale_orig': prezzo_autosost
            });
            corpo_proforma.imponibile += prezzo_autosost;
          }
        }

        break;
      case 1:
        const [ordini] = await this.entityManager.query('SELECT * FROM ordini__pacchetti WHERE id_proforma = ?', [model.id])
        const ordine_rows = await this.entityManager.query('SELECT * FROM ordini__prodotti_quantita WHERE ordine = ?', [ordini.id])

        const extras = [0, 'Soccorso 40km', 'Soccorso 60km', 'Soccorso 100km', null, 'Auto Sostitutiva'];

        for (let row of ordine_rows) {
          const netto = parseFloat(row.prezzo_netto)
          if (row.quantita !== '0' && netto !== 0.0) {
            const [tipi_garanzie] = await this.entityManager.query('SELECT denominazione FROM tipi_garanzie WHERE id = ?', [row.prodotto])
            const descrizione = `PACK ${!row.is_extra ? `Garanzie ${tipi_garanzie.denominazione}` : extras[row.prodotto]}`
            corpo_proforma.corpo.push({
              'descrizione': descrizione,
              'quantita': row.quantita,
              'prezzo_unitario_orig': netto,
              'prezzo_unitario': netto.toFixed(2).replace('.', ','),
              'totale': Number(netto * row.quantita).toFixed(2).replace('.', ','),
              'totale_orig': netto * row.quantita
            });
            corpo_proforma.imponibile += netto * row.quantita;

          }
        }

        break;
      case 2: // Card Soccorso
        const cards = await this.entityManager.query('SELECT * FROM card_soccorso_2 WHERE id_proforma = ?', [model.id])
        for (let card of cards) {
          const targa = await this.entityManager.query('SELECT targa FROM veicoli WHERE id = ?', [card.veicolo])
          const prezzo = await this.ordiniContrConsumoCardsService.getPrezzoSoccorso(card.dealer, card.tipo_card, card.data_attivazione)
          const prezzo_formatted = Number(prezzo).toFixed(2).replace('.', ',')
          const descrizione = card.tipo_card === 'C' ? (bold_text ? `<b>${targa}</b>:` : `${targa}:`) + 'Card Soccorso Camper' : (bold_text ? `<b>${targa}</b>:` : `${targa}:`) + `Card C ${card.tipo_card.toString().padStart(3, '0')}`
          corpo_proforma.corpo.push({
            'descrizione': descrizione,
            'quantita': 1,
            'prezzo_unitario_orig': prezzo,
            'prezzo_unitario': prezzo_formatted,
            'totale': prezzo_formatted,
            'totale_orig': prezzo
          });
          corpo_proforma.imponibile += prezzo;
        }

        const restituzioni = await this.entityManager.query('SELECT * FROM card_soccorso_2 WHERE id_proforma_restituzione = ?', [model.id]);
        const tipi_rest = [0, 'RR', 'RN'];
        const tipi_rest_long = [0, 'Restituzione Regionale', 'Restituzione Nazionale'];

        for (let card of restituzioni) {
          const targa = await this.entityManager.query('SELECT targa FROM veicoli WHERE id = ?', [card.veicolo])
          const prezzo = await this.ordiniContrConsumoCardsService.getPrezzoSoccorso(card.dealer, tipi_rest[card.restituzione], card.data_attivazione)
          const prezzo_formatted = Number(prezzo).toFixed(2).replace('.', ',')

          corpo_proforma.corpo.push({
            'descrizione': `<b>${targa}</b>: ${tipi_rest_long[card.restituzione]}`,
            'quantita': 1,
            'prezzo_unitario': prezzo_formatted,
            'totale': prezzo_formatted,
          });
          corpo_proforma.imponibile += prezzo;
        }
        break;
      case 3: // Pack Card Soccorso
        const [ordine] = await this.entityManager.query('SELECT * FROM ordini__pacchetti_cardss WHERE id_proforma = ?', [model.id])
        const ordine_row = await this.entityManager.query('SELECT * FROM ordini__pacchetti_cardss_quantita WHERE ordine = ?', [ordine.id])

        const tipi_card: { [key: string]: any } = {
          '40': 'PACK Card Soccorso 40km',
          '60': 'PACK Card Soccorso 60km',
          '100': 'PACK Card Soccorso 100km',
          'C': 'PACK Card Soccorso Camper',
          'RN': 'PACK Restituzioni Nazionali',
          'RR': 'PACK Restituzioni Regionali'
        };

        for (let row of ordine_row) {
          const netto = parseFloat(row.prezzo_netto);
          if (row.quantita !== 0 && netto !== 0.0) {
            corpo_proforma.corpo.push({
              'descrizione': tipi_card[row.soccorso],
              'quantita': row.quantita,
              'prezzo_unitario_orig': netto,
              'prezzo_unitario': Number(netto).toFixed(2).replace('.', ','),
              'totale': Number(netto * row.quantita).toFixed(2).replace('.', ','),
              'totale_orig': netto * row.quantita
            });
            corpo_proforma.imponibile += netto * row.quantita;
          }
        }
        break;
      case 4:
        const [abbonamento] = await this.entityManager.query('SELECT * FROM ordini__abbonamenti_garanzie WHERE id = ?', [model.abbonamento__id])
        const descrizione = `Quota Abbonamento ${format(new Date(model.data_proforma), 'MM/yyyy')}`
        if (abbonamento.ddc_qta !== '0') {
          corpo_proforma.corpo.push({
            'descrizione': `${descrizione}: DDC ${abbonamento.ddc_qta === '99999' ? 'UNLIMITED' : abbonamento.ddc_qta}`,
            'quantita': 1,
            'prezzo_unitario_orig': parseFloat(abbonamento.ddc_prz),
            'prezzo_unitario': Number(abbonamento.ddc_prz).toFixed(2).replace('.', ','),
            'totale': Number(abbonamento.ddc_prz).toFixed(2).replace('.', ','),
            'totale_orig': parseFloat(abbonamento.ddc_prz)
          });
          corpo_proforma.imponibile += parseFloat(abbonamento.ddc_prz);
        }

        if (abbonamento.gest_qta !== '0') {
          corpo_proforma.corpo.push({
            'descrizione': `${descrizione}: GEST ${abbonamento.gest_qta === '99999' ? 'UNLIMITED' : abbonamento.ddc_qta}`,
            'quantita': 1,
            'prezzo_unitario_orig': parseFloat(abbonamento.gest_prz),
            'prezzo_unitario': Number(abbonamento.gest_prz).toFixed(2).replace('.', ','),
            'totale': Number(abbonamento.gest_prz).toFixed(2).replace('.', ','),
            'totale_orig': parseFloat(abbonamento.gest_prz)
          });
          corpo_proforma.imponibile += parseFloat(abbonamento.gest_prz);
        }
        break;
      case 5: // Libere
        const rows = await this.entityManager.query('SELECT * FROM proforma__liberi_rows WHERE proforma = ? AND is_deleted = false', [model.id])
        let totale_pf = 0.0
        for (let row of rows) {
          corpo_proforma.corpo.push({
            'descrizione': row.descrizione,
            'quantita': row.quantita,
            'prezzo_unitario_orig': parseFloat(row.prezzo_unitario),
            'prezzo_unitario': Number(row.prezzo_unitario).toFixed(2).replace('.', ','),
            'totale': Number(row.prezzo_unitario * row.quantita).toFixed(2).replace('.', ','),
            'totale_orig': (parseFloat(row.prezzo_unitario) * Number(row.quantita))
          });
          corpo_proforma.imponibile += (parseFloat(row.prezzo_unitario) * Number(row.quantita));
        }
        break;
      case 10: // Garanzie - import
      case 11: // Pack Garanzie import
      case 12: // Card Ss import
      case 13: // Pack Card Ss import
      case 14: // Abbonamenti import
      case 15: // Libere import
        const rowss = await this.entityManager.query('SELECT * FROM proforma__imported_rows WHERE proforma = ?', [model.id])

        for (let row of rowss) {
          corpo_proforma.corpo.push({
            'descrizione': row.descrizione,
            'quantita': row.quantita,
            'prezzo_unitario_orig': parseFloat(row.prezzo_unitario),
            'prezzo_unitario': Number(row.prezzo_unitario).toFixed(2).replace('.', ','),
            'totale': Number(row.prezzo_unitario * row.quantita).toFixed(2).replace('.', ','),
            'totale_orig': (parseFloat(row.prezzo_unitario) * Number(row.quantita))
          });
          corpo_proforma.imponibile += (parseFloat(row.prezzo_unitario) * Number(row.quantita));
        }
        break
      default:
        throw new NotFoundException(`Tipo proforma sconosciuto (${model.tipo_proforma})`)
    }
    return corpo_proforma
  }

  async dataToFattura(id: any) {
    // Realizar todas las consultas en paralelo para mejorar el rendimiento
    const [proformaResult, incassatoResult, fatturatoResult, ultimaFatturaResult] = await Promise.all([
      this.entityManager.query('SELECT importo, saldo FROM v_proforma WHERE id = ?', [id]),
      this.entityManager.query('SELECT COALESCE(SUM(f.incasso), 0) AS incasso FROM fatture f WHERE f.rif_proforma = ?', [id]),
      this.entityManager.query('SELECT COALESCE(SUM(f.importo_ft), 0) AS futt FROM fatture f WHERE f.rif_proforma = ?', [id]),
      this.entityManager.query('SELECT MAX(f.data_fattura) as ultima FROM fatture f WHERE f.rif_proforma = ?', [id])
    ]);

    // Obtener los valores de los resultados de consulta
    const proforma = proformaResult[0];
    const incasso = Number(incassatoResult[0].incasso || 0);
    const futt = Number(fatturatoResult[0].futt || 0);
    const ultima = ultimaFatturaResult[0].ultima;

    // Convertir el saldo a número para asegurarnos que es un valor numérico
    const importo = Number(proforma.importo);
    const tot_proforma = Math.round((importo + importo * 0.22) * 100) / 100;

    // Calcular valores derivados, asegurando que son números
    const da_saldare = (tot_proforma - futt).toFixed(2).replace('.', ',');
    const da_incassare = (tot_proforma - incasso).toFixed(2).replace('.', ',');

    return {
      proforma,
      tot_proforma: tot_proforma.toFixed(2),
      incasso: incasso.toFixed(2),
      futt: futt.toFixed(2),
      da_saldare,
      da_incassare,
      ultima
    };
  }


}

