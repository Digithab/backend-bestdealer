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
import { WrapperType } from 'src/generate-metadata';


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
  totale_pf = 0;
  ordini: any;

  constructor(

    @Inject(forwardRef(() => OrdiniContrConsumoService))
    private readonly ordiniContrConsumoService: WrapperType<OrdiniContrConsumoService>,

    @InjectEntityManager() private entityManager: EntityManager,

    @InjectDataSource() private dataSource: DataSource,


    @Inject(forwardRef(() => MailService))
    private readonly mailService: WrapperType<MailService>,

    @Inject(forwardRef(() => OrdiniContrConsumoCardsService))
    private ordiniContrConsumoCardsService: WrapperType<OrdiniContrConsumoCardsService>,


    @Inject(forwardRef(() => GenPdfService))
    private readonly genPdfService: WrapperType<GenPdfService>

  ) { }



  async create(createProformaDto: any) {

    const proformaId = await this.dataSource.transaction(async (manager) => {
      const model = createProformaDto;
      console.log('model: ', model);
      // Actualizar cliente y crear proforma en una sola transacción
      if (model.tipo_cliente === '1' || model.tipo_cliente === 1) {
        await manager
          .createQueryBuilder()
          .update('clienti')
          .set({ abilitazione_proforma: 1 })
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
      console.log('rowsWithProformaId___ ', proformaId)
      // Recalcular y generar PDF después de la transacción      
      return proformaId;
    });
    console.log('proformaId___ ', proformaId)

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
    // Validar y normalizar parámetros
    const validPage = Math.max(1, Number(page));
    const validLimit = Math.max(1, Math.min(50, Number(limit)));
    const validOrder = ['ASC', 'DESC'].includes(order) ? order : 'DESC';
    const sortColumn = ProformaSearchCardKeys.includes(sort) ? sort : 'id';

    try {
      // Crear query base - usar una vista indexada si es posible
      const baseQuery = this.entityManager.createQueryBuilder()
        .from('v_proforma', 'vp')
        .where('vp.is_deleted = 0');

      // Aplicar filtros de búsqueda
      this.applyFilters(baseQuery, search);

      // Ejecutar consultas en paralelo para maximizar rendimiento
      const [proformaResult, aggregationResult] = await Promise.all([
        // Consulta para obtener proformas con paginación
        this.entityManager.createQueryBuilder()
          .select('vp.*')
          .from('v_proforma', 'vp')
          .where('vp.is_deleted = 0')
          .andWhere(baseQuery.expressionMap.wheres?.[1]?.condition || '1=1') // Reutilizar los filtros
          .setParameters(baseQuery.expressionMap.parameters || {})
          .orderBy(`vp.${sortColumn}`, validOrder)
          .offset((validPage - 1) * validLimit)
          .limit(validLimit)
          .getRawMany(),

        // Consulta para obtener totales (usando COUNT() OVER() para mejor rendimiento)
        this.entityManager.createQueryBuilder()
          .select([
            'COUNT(1) as total',
            'COALESCE(SUM(vp.importo), 0) as importo_total',
            'COALESCE(SUM(vp.incasso), 0) as incaso_total',
            'COALESCE(SUM(vp.saldo), 0) as saldo_total'
          ])
          .from('v_proforma', 'vp')
          .where('vp.is_deleted = 0')
          .andWhere(baseQuery.expressionMap.wheres?.[1]?.condition || '1=1')
          .setParameters(baseQuery.expressionMap.parameters || {})
          .getRawOne()
      ]);

      const proforma = proformaResult || [];
      const total = Number(aggregationResult?.total || 0);
      const importo_total = Number(aggregationResult?.importo_total || 0);
      const incaso_total = Number(aggregationResult?.incaso_total || 0);
      const saldo_total = Number(aggregationResult?.saldo_total || 0);

      // Optimización: solo procesar si hay proformas
      if (proforma.length === 0) {
        return { proforma: [], total, importo_total, incaso_total, saldo_total };
      }

      // Extraer IDs para la consulta de facturas (con seguridad para prevenir SQL injection)
      const proformaIds = proforma.map(pr => pr.id).filter(id => id !== undefined && id !== null);

      // Optimización: Solo buscar facturas si hay IDs válidos
      if (proformaIds.length === 0) {
        return {
          proforma: proforma.map(pr => ({ ...pr, faturre: [] })),
          total, importo_total, incaso_total, saldo_total
        };
      }

      // Usar una sola consulta para obtener todas las facturas relacionadas
      // Añadir índices específicos en la base de datos para esta consulta
      const allFatture = await this.dataSource
        .createQueryBuilder()
        .select([
          'f.*',
          'f.rif_proforma' // Asegurar que este campo está incluido explícitamente
        ])
        .from('fatture', 'f')
        .where('f.rif_proforma IN (:...ids)', { ids: proformaIds })
        // Limitar columnas si es posible
        // .addSelect(['f.id', 'f.rif_proforma', 'f.other_needed_columns'])
        .getRawMany();

      // Crear un mapa de facturas por ID de proforma para acceso O(1)
      const fattureMap = {};
      for (const fattura of allFatture) {
        const rifProforma = fattura.rif_proforma;
        if (!fattureMap[rifProforma]) {
          fattureMap[rifProforma] = [];
        }
        fattureMap[rifProforma].push(fattura);
      }

      // Asignar facturas a cada proforma con acceso O(1)
      const profWithfact = proforma.map(pr => ({
        ...pr,
        faturre: fattureMap[pr.id] || []
      }));

      return { proforma: profWithfact, total, importo_total, incaso_total, saldo_total };
    } catch (error) {
      // Log error pero retornar un resultado vacío para no bloquear la UI
      console.error('Error in getProforma:', error);
      return { proforma: [], total: 0, importo_total: 0, incaso_total: 0, saldo_total: 0 };
    }
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
    console.log('actionFinalizzaProforma___ ', id)
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
        record_id: id,
        user: 'default'
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

        if (key === 'id_cliente') {
          query.andWhere(`vp.${key} = :${key}`, { [key]: value });
        }

        if (key === 'saldo' && value) {

          if (value == "Saldato") {
            query.andWhere(`vp.${key} = :${key}`, { [key]: 0 });
          } else {
            query.andWhere(`vp.${key} >= :${key}`, { [key]: 1 });
          }
        }

        if (typeof value === 'string' && key !== 'data_proforma' && key !== 'saldo' && key !== 'id_cliente') {
          query.andWhere(`vp.${key} LIKE :${key}`, { [key]: `%${value}%` });
        } else if (typeof value === 'number') {
          query.andWhere(`vp.${key} = :${key}`, { [key]: value });
        }
      }
    });
  }


  async actionInviaProforma(id: any) {
    const idProforma = id.id;

    // Get proforma data with a single query
    const [proforma] = await this.entityManager.query('SELECT * FROM proforma WHERE id = ?', [idProforma]);
    if (!proforma) throw new NotFoundException('Proforma non trovata.');

    let to = '';
    let cc = [];
    let subject = '';

    // Handle different client types
    try {
      if (proforma.tipo_cliente === 0) { // Dealer
        const [[dealer], contatti, [agente]] = await Promise.all([
          this.entityManager.query('SELECT denominazione FROM dealers WHERE id = ?', [proforma.id_cliente]),
          this.entityManager.query('SELECT email FROM dealers__contatti WHERE dealer = ? LIMIT 3', [proforma.id_cliente]),
          this.entityManager.query('SELECT email FROM agenti WHERE id = ?', [proforma.id_cliente])
        ]);

        if (!dealer) throw new BadRequestException('Dealer non trovato.');

        subject = `Invio Proforma: Dealer ${dealer.denominazione}`;

        // Add agent email to cc if exists
        if (agente?.email) cc.push(agente.email);

        // Add only valid contact emails to cc (maximum 2)
        contatti.slice(0, 2).forEach(contatto => {
          if (contatto?.email) cc.push(contatto.email);
        });

      } else if (proforma.tipo_cliente === 1) { // Cliente
        const [cliente] = await this.entityManager.query('SELECT * FROM clienti WHERE id = ?', [proforma.id_cliente]);
        if (!cliente) throw new BadRequestException('Cliente non trovato.');
        if (!cliente.email) throw new BadRequestException('Email cliente non fornita.');

        to = cliente.email;
        subject = `Invio Proforma: Cliente ${cliente.denominazione}`;

        // Now that we have cliente, we can check for the agent
        if (cliente.agente !== 0) {
          const [agente] = await this.entityManager.query('SELECT email FROM agenti WHERE id = ?', [cliente.agente]);
          if (agente?.email) cc.push(agente.email);
        }

      } else {
        throw new BadRequestException('Tipo cliente non valido.');
      }
    } catch (error) {
      throw error instanceof BadRequestException || error instanceof NotFoundException
        ? error
        : new BadRequestException('Errore durante il recupero dei dati: ' + error.message);
    }

    // Calculate template and reminders
    const isFirstSend = proforma.data_invio === '1900-01-01';
    const solleciti = proforma.date_invii_successivi ? proforma.date_invii_successivi.split('|').filter(Boolean) : [];
    //const num_solleciti = solleciti.length;
    const num_solleciti = proforma.date_invii_successivi === 0 ? 0 : solleciti.length
    const template = isFirstSend ? 'invio' : `sollecito_${Math.min(3, num_solleciti + 1)}`;
    //const template = proforma.datainvio === '1900-01-01' ? 'invio' : `sollecito${Math.min(3, num_solleciti + 1)}`
    //const data_proforma = format(new Date(proforma.data_proforma), 'dd/MM/yyyy');


    const data_proforma = format(new Date(proforma.data_proforma), 'dd/MM/yyyy');
    console.log('template: ', template)
    // Send email
    await this.mailService.sendProformaEmail(
      to || 'aetiru@gmail.com', // Fallback if no recipient
      'aetiru@gmail.com', // cc.length ? cc : 
      'aetiru@gmail.com', // BCC
      proforma.id,
      solleciti,
      data_proforma,
      subject,
      template
    );

    // Update proforma with send dates
    const currentDate = format(new Date(), 'yyyy-MM-dd');

    if (isFirstSend) {
      await this.entityManager
        .createQueryBuilder()
        .update('proforma')
        .set({ data_invio: currentDate })
        .where('id = :id', { id: idProforma })
        .execute();
    } else {
      const newDateInviiSuccessivi = !proforma.date_invii_successivi
        ? currentDate
        : `${proforma.date_invii_successivi}|${currentDate}`.substring(0, 32);

      await this.entityManager
        .createQueryBuilder()
        .update('proforma')
        .set({ date_invii_successivi: newDateInviiSuccessivi })
        .where('id = :id', { id: idProforma })
        .execute();
    }

    return { success: true, message: 'Proforma inviata con successo' };
  }

  async actionNotificaSelezionati(sel: any[]) {
    for (const id of sel) {
      try {
        // Obtener proforma con una sola consulta
        const [proforma] = await this.entityManager.query('SELECT * FROM proforma WHERE id = ?', [id]);

        if (!proforma) {
          throw new NotFoundException(`Proforma con ID ${id} no encontrada`);
        }

        let to = '';
        const cc = [];
        let subject = '';
        let clienteDenominazione = '';

        // Manejar diferencia entre Dealer (0) y Cliente (1)
        if (proforma.tipo_cliente === 0) { // Dealer
          const [dealer] = await this.entityManager.query('SELECT denominazione FROM dealers WHERE id = ?', [proforma.id_cliente]);

          if (!dealer) {
            throw new BadRequestException(`Dealer con ID ${proforma.id_cliente} no encontrado`);
          }

          clienteDenominazione = dealer.denominazione;
          subject = `Invio Proforma: Dealer ${clienteDenominazione}`;

          // Obtener contactos y agentes en paralelo
          const [contatti, [agente]] = await Promise.all([
            this.entityManager.query('SELECT email FROM dealers__contatti WHERE dealer = ? LIMIT 3', [proforma.id_cliente]),
            this.entityManager.query('SELECT email FROM agenti WHERE id = ?', [proforma.id_cliente])
          ]);

          if (agente?.email) cc.push(agente.email);

          // Solo añadir correos válidos de contactos
          contatti.forEach(contatto => {
            if (contatto?.email) cc.push(contatto.email);
          });

        } else if (proforma.tipo_cliente === 1) { // Cliente
          const [cliente] = await this.entityManager.query('SELECT * FROM clienti WHERE id = ?', [proforma.id_cliente]);

          if (!cliente) {
            throw new BadRequestException(`Cliente con ID ${proforma.id_cliente} no encontrado`);
          }

          if (!cliente.email) {
            throw new BadRequestException('Email cliente no proporcionado');
          }

          to = cliente.email;
          clienteDenominazione = cliente.denominazione;
          subject = `Invio Proforma: Cliente ${clienteDenominazione}`;

          // Obtener agente solo si es necesario
          if (cliente.agente !== 0) {
            const [agente] = await this.entityManager.query('SELECT email FROM agenti WHERE id = ?', [cliente.agente]);
            if (agente?.email) cc.push(agente.email);
          }

        } else {
          throw new BadRequestException(`Tipo de proforma desconocido: ${proforma.tipo_proforma}`);
        }

        // Calcular número de solicitudes y determinar plantilla
        const solleciti = proforma.date_invii_successivi ? proforma.date_invii_successivi.split('|').filter(Boolean) : [];
        const num_solleciti = solleciti.length;
        const template = proforma.data_invio === '1900-01-01' ? 'invio' : `sollecito_${Math.min(3, num_solleciti + 1)}`;
        const data_proforma = format(new Date(proforma.data_proforma), 'dd/MM/yyyy');

        // Enviar correo
        await this.mailService.sendProformaEmail(
          to || 'aetiru@gmail.com', // Usar correo de respaldo si no hay destinatario
          cc.length ? cc : ['aetiru@gmail.com'],
          'aetiru@gmail.com',
          proforma.id,
          solleciti,
          data_proforma,
          subject,
          template
        );

        // Actualizar fechas de envío
        const currentDate = format(new Date(), 'yyyy-MM-dd');

        if (proforma.data_invio === '1900-01-01') {
          // Primer envío
          await this.entityManager
            .createQueryBuilder()
            .update('proforma')
            .set({ data_invio: currentDate })
            .where('id = :id', { id })
            .execute();
        } else {
          // Actualizar solicitudes posteriores (máximo 3)
          if (!proforma.date_invii_successivi) {
            await this.entityManager
              .createQueryBuilder()
              .update('proforma')
              .set({ date_invii_successivi: currentDate })
              .where('id = :id', { id })
              .execute();
          } else if (solleciti.length < 3) {
            await this.entityManager
              .createQueryBuilder()
              .update('proforma')
              .set({ date_invii_successivi: `${proforma.date_invii_successivi} | ${currentDate}` })
              .where('id = :id', { id })
              .execute();
          }
        }

      } catch (error) {
        console.error(`Error procesando proforma ID ${id}:`, error.message);
        throw error; // Re-lanzar para manejo superior o convertir a respuesta HTTP apropiada
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
        const [garanzie, soccorsi] = await Promise.all([
          this.entityManager.query('SELECT * FROM garanzie WHERE id_proforma = ?', [model.id]),
          this.entityManager.query('SELECT * FROM garanzie WHERE id_proforma_soccorso = ?', [model.id])
        ]);
        console.log('garanzie___ ', garanzie);

        // Función auxiliar para formatear precios
        const formatNumber = (num) => Number(num).toFixed(2).replace('.', ',');

        // Función para calcular el consumo efectivo
        const calcularConsumoEfectivo = (durata) => Number(durata) / 12;

        // Procesamiento de garantías principales
        for (let garanzia of garanzie) {

          const [[targa], [tipi]] = await Promise.all([
            this.entityManager.query('SELECT * FROM veicoli WHERE id = ?', [garanzia.veicolo]),
            this.entityManager.query('SELECT * FROM tipi_garanzie WHERE id = ?', [garanzia.tipo_garanzia])
          ]);

          const prezzo = await this.ordiniContrConsumoCardsService.getPrezzoGaranzia(
            garanzia.dealer,
            garanzia.tipo_garanzia,
            garanzia.data_attivazione
          );

          const consumo_effettivo = calcularConsumoEfectivo(garanzia.durata);
          const quantita = consumo_effettivo - parseInt(garanzia.consumo_pack);
          const prezzo_singolo_formatted = formatNumber(prezzo);
          const prezzo_totale = prezzo * quantita;
          const prezzo_formatted = formatNumber(prezzo_totale);


          if (prezzo_totale > 0) {
            const prefisso = bold_text ? `<b>${targa.targa}</b>: ` : `${targa.targa}: `;

            corpo_proforma.corpo.push({
              'descrizione': prefisso + tipi.denominazione,
              'quantita': quantita,
              'prezzo_unitario_orig': prezzo,
              'prezzo_unitario': prezzo_singolo_formatted,
              'totale': prezzo_formatted,
              'totale_orig': prezzo_totale
            });

            corpo_proforma.imponibile += parseFloat(Number(prezzo_totale).toFixed(2));
          }
        }

        // Procesamiento de servicios de socorro
        const prezziDefaultSoccorsi = { 40: 20, 60: 25, 100: 30 };

        for (let garanzia_soccorso of soccorsi) {

          const [[targa], prezzo_singolo] = await Promise.all([
            this.entityManager.query('SELECT targa FROM veicoli WHERE id = ?', [garanzia_soccorso.veicolo]),
            this.ordiniContrConsumoService.getPrezzoGaranzia(
              garanzia_soccorso.dealer,
              garanzia_soccorso.data_attivazione,
              garanzia_soccorso.soccorso__km,
              prezziDefaultSoccorsi[garanzia_soccorso.soccorso__km]
            )
          ]);

          const consumo_effettivo = calcularConsumoEfectivo(garanzia_soccorso.durata);
          const qta_soccorso = consumo_effettivo - parseInt(garanzia_soccorso.consumo_pack_soccorso);
          const prezzo_soccorso = prezzo_singolo * qta_soccorso;
          const prezzo_formatted = formatNumber(prezzo_soccorso);
          if (prezzo_formatted !== '0,00') {
            const prefisso = bold_text ? `<b>${targa.targa}</b>: ` : `${targa.targa}: `;

            corpo_proforma.corpo.push({
              'descrizione': prefisso + 'Soccorso stradale ' + garanzia_soccorso.soccorso__km + ' km',
              'quantita': qta_soccorso,
              'prezzo_unitario_orig': prezzo_singolo,
              'prezzo_unitario': formatNumber(prezzo_singolo),
              'totale': prezzo_formatted,
              'totale_orig': prezzo_soccorso
            });
            corpo_proforma.imponibile += prezzo_soccorso;
          }
        }

        // Procesamiento de auto sostitutiva
        const autosost = await this.entityManager.query('SELECT * FROM garanzie WHERE id_proforma_autosost = ?', [model.id]);

        for (let gr_autosost of autosost) {

          const [[targaResult], [prezzoResult]] = await Promise.all([
            this.entityManager.query('SELECT targa FROM veicoli WHERE id = ?', [gr_autosost.veicolo]),
            this.entityManager.query(`
            SELECT auto_sost FROM ordini__contratti_a_consumo ocac
            WHERE ocac.dealer = ?
            AND NOW() BETWEEN ocac.data_inizio_contratto AND ocac.data_fine_contratto
            LIMIT 1
          `, [gr_autosost.dealer])
          ]);

          const targa = targaResult.targa; // Corregido el acceso a la propiedad targa

          // Verificamos que tenemos un resultado y accedemos a la propiedad correcta
          if (prezzoResult && 'auto_sost' in prezzoResult) {
            const prezzo_autosost = prezzoResult.auto_sost;
            const prezzo_formatted = formatNumber(prezzo_autosost);

            // Corregido: usamos gr_autosost en lugar de garanzie
            const consumo_effettivo = calcularConsumoEfectivo(gr_autosost.durata);
            const qta_autosost = consumo_effettivo - Number(gr_autosost.consumo_pack_autosost || 0);

            if (prezzo_formatted !== '0,00' && qta_autosost > 0) {
              const prefisso = bold_text ? `<b>${targa}</b>: ` : `${targa}: `;

              corpo_proforma.corpo.push({
                'descrizione': prefisso + 'Auto Sostitutiva',
                'quantita': qta_autosost,
                'prezzo_unitario_orig': prezzo_autosost,
                'prezzo_unitario': prezzo_formatted,
                'totale': formatNumber(prezzo_autosost * qta_autosost),
                'totale_orig': prezzo_autosost * qta_autosost
              });

              corpo_proforma.imponibile += prezzo_autosost * qta_autosost;
            }
          }
        }

        break;
      case 1:
        // Obtener datos de ordini
        const [ordini] = await this.entityManager.query('SELECT * FROM ordini__pacchetti WHERE id_proforma = ?', [model.id]);
        const ordine_rows = await this.entityManager.query('SELECT * FROM ordini__prodotti_quantita WHERE ordine = ?', [ordini.id]);

        // Filtrar para obtener solo IDs de productos relevantes
        const relevantProductIds = ordine_rows
          .filter(row => row.quantita !== '0' && parseFloat(row.prezzo_netto) !== 0.0 && !row.is_extra)
          .map(row => row.prodotto);

        // Obtener todos los tipos de garantía en una sola consulta
        const tipi_garanzie_map = {};
        if (relevantProductIds.length > 0) {
          const garanzie = await this.entityManager.query(
            'SELECT id, denominazione FROM tipi_garanzie WHERE id IN (?)',
            [relevantProductIds]
          );

          garanzie.forEach(g => {
            tipi_garanzie_map[g.id] = g.denominazione;
          });
        }

        // Mapeo de extras más mantenible
        const extrasMap = {
          0: 'Soccorso 40km',
          1: 'Soccorso 40km',
          2: 'Soccorso 60km',
          3: 'Soccorso 100km',
          5: 'Auto Sostitutiva'
        };

        // Procesar cada fila
        for (const row of ordine_rows) {
          const netto = parseFloat(row.prezzo_netto);
          if (row.quantita !== '0' && netto !== 0.0) {
            let descrizione;
            if (!row.is_extra) {
              descrizione = `PACK Garanzie ${tipi_garanzie_map[row.prodotto] || ''}`;
            } else {
              descrizione = `PACK ${extrasMap[row.prodotto] || ''}`;
            }

            const cantidad = parseFloat(row.quantita);
            const totalRow = netto * cantidad;

            corpo_proforma.corpo.push({
              'descrizione': descrizione,
              'quantita': row.quantita,
              'prezzo_unitario_orig': netto,
              'prezzo_unitario': netto.toFixed(2).replace('.', ','),
              'totale': totalRow.toFixed(2).replace('.', ','),
              'totale_orig': totalRow
            });

            corpo_proforma.imponibile += totalRow;
          }
        }
        break;
      case 2: // Card Soccorso
        // 1. Obtener cards y restituzioni en paralelo
        const [cards, restituzioni] = await Promise.all([
          this.entityManager.query('SELECT cs.*, v.targa FROM card_soccorso_2 cs JOIN veicoli v ON cs.veicolo = v.id WHERE cs.id_proforma = ?', [model.id]),
          this.entityManager.query('SELECT cs.*, v.targa FROM card_soccorso_2 cs JOIN veicoli v ON cs.veicolo = v.id WHERE cs.id_proforma_restituzione = ?', [model.id])
        ]);

        // 2. Procesar todas las tarjetas en paralelo
        const tipi_rest = [0, 'RR', 'RN'];
        const tipi_rest_long = [0, 'Restituzione Regionale', 'Restituzione Nazionale'];

        // Preparar todas las promesas de precio juntas
        const cardPromises = cards.map(card =>
          this.ordiniContrConsumoCardsService.getPrezzoSoccorso(card.dealer, card.tipo_card, card.data_attivazione)
            .then(prezzo => ({
              card,
              prezzo,
              prezzo_formatted: Number(prezzo).toFixed(2).replace('.', ','),
              isRestituzione: false
            }))
        );

        const restPromises = restituzioni.map(card =>
          this.ordiniContrConsumoCardsService.getPrezzoSoccorso(card.dealer, tipi_rest[card.restituzione], card.data_attivazione)
            .then(prezzo => ({
              card,
              prezzo,
              prezzo_formatted: Number(prezzo).toFixed(2).replace('.', ','),
              isRestituzione: true
            }))
        );

        // 3. Esperar a que se completen todas las promesas de precios
        const allResults = await Promise.all([...cardPromises, ...restPromises]);

        // 4. Procesar los resultados y construir el cuerpo
        for (const result of allResults) {
          const { card, prezzo, prezzo_formatted, isRestituzione } = result;

          if (!isRestituzione) {
            // Procesar card normal
            const tagPrefix = bold_text ? `<b>${card.targa}</b>:` : `${card.targa}:`;
            const descrizione = card.tipo_card === 'C'
              ? `${tagPrefix} Card Soccorso Camper`
              : `${tagPrefix} Card C ${card.tipo_card.toString().padStart(3, '0')}`;

            corpo_proforma.corpo.push({
              'descrizione': descrizione,
              'quantita': 1,
              'prezzo_unitario_orig': prezzo,
              'prezzo_unitario': prezzo_formatted,
              'totale': prezzo_formatted,
              'totale_orig': prezzo
            });
          } else {
            // Procesar restituzione
            corpo_proforma.corpo.push({
              'descrizione': `<b>${card.targa}</b>: ${tipi_rest_long[card.restituzione]}`,
              'quantita': 1,
              'prezzo_unitario': prezzo_formatted,
              'totale': prezzo_formatted,
              'prezzo_unitario_orig': prezzo,
              'totale_orig': prezzo
            });
          }

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

