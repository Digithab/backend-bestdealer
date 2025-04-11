import { ForbiddenException, HttpException, HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import { CreateCardSoccorsoDto } from './dto/create-card_soccorso.dto';
import { UpdateCardSoccorsoDto } from './dto/update-card_soccorso.dto';
import { InjectDataSource, InjectEntityManager } from '@nestjs/typeorm';
import { DataSource, EntityManager, SelectQueryBuilder } from 'typeorm';
import { Card, CardSearchKeys } from './interface/card.interface';
import { add, endOfMonth, format } from 'date-fns';
import { User, Vehiculo } from 'src/interfaces/interfaces';
import { UsersService } from 'src/modules/users/users.service';
import { DisponibilitaPacchettiCardService } from '../disponibilita_pacchetti_card/disponibilita_pacchetti_card.service';
import { OrdiniContrConsumoCardsService } from 'src/modules/ordini/ordini-contr-consumo-cards/ordini-contr-consumo-cards.service';
import { GenPdfService } from 'src/modules/gen-pdf/gen-pdf.service';
import { ProformaService } from 'src/modules/Fatture/proforma/proforma.service';

@Injectable()
export class CardSoccorsoService {

  constructor(

    @InjectEntityManager() private entityManager: EntityManager,

    @InjectDataSource() private dataSource: DataSource,

    private usersService: UsersService,

    private disponibilitaPacchettiCardService: DisponibilitaPacchettiCardService,

    private ordiniContrConsumoCardsService: OrdiniContrConsumoCardsService,

    private readonly genPdfService: GenPdfService,

    private readonly proformaService: ProformaService
  ) { }


  // async create(createCardSoccorsoDto: CreateCardSoccorsoDto | any, userId: string) {

  //   const cardSoccorso = createCardSoccorsoDto.data.CardSoccorso;
  //   const vehicolo = createCardSoccorsoDto.data.Veicoli;
  //   const clienti = createCardSoccorsoDto.data.Clienti;
  //   let prezzo_card = 0;
  //   let prezzo_rest = 0;
  //   let card_da_pagare = false;
  //   let rest_da_pagare = false;
  //   let pf_found: any
  //   let id_card_soccorso: any;
  //   const result = await this.dataSource.transaction(async (manager) => {

  //     const user = await this.validateUser(userId);
  //     if (user.role !== 'dealer' && user.role !== 'admin') {
  //       throw new ForbiddenException('No tienes permisos para crear garantías');
  //     }

  //     const today = new Date()

  //     cardSoccorso.data_attivazione = today;
  //     cardSoccorso.data_scadenza = add(today, { years: 1 });
  //     cardSoccorso.stato = 1;
  //     cardSoccorso.id_proforma = 0;
  //     cardSoccorso.id_proforma_restituzione = 0;
  //     cardSoccorso.is_deleted = false;

  //     if (user.role === 'dealer') {

  //       cardSoccorso.dealer = user.id.split('-')[0];
  //       cardSoccorso.data_scadenza = add(today, { years: 1 });
  //     }

  //     clienti.abilitazione_proforma = false;
  //     vehicolo.targa_originaria = '-'

  //     const dealer = await this.findDealer(cardSoccorso.dealer)

  //     if (cardSoccorso.tipo_card === 'C') cardSoccorso.restituzione = 0;

  //     clienti.abilitazione_proforma = false;
  //     clienti.agente = cardSoccorso.agente;
  //     clienti.denominazione = clienti.denominazione.toUpperCase();

  //     const clientiSave = await manager
  //       .createQueryBuilder()
  //       .insert()
  //       .into('clienti')
  //       .values(
  //         clienti
  //       )
  //       .execute();
  //     const { raw: { insertId } } = clientiSave;
  //     const idClient = insertId

  //     vehicolo.cliente = idClient;
  //     cardSoccorso.proprietario = idClient;

  //     const { marcaId, modeloId } = await this.processVehicleBrands(vehicolo, manager);

  //     vehicolo.immatricolazione = format(vehicolo.immatricolazione, "yyyy-MM-dd")

  //     const { modelo, ...newDtoVehicolo } = vehicolo
  //     const vehicoloSave = await manager
  //       .createQueryBuilder()
  //       .insert()
  //       .into('veicoli')
  //       .values(
  //         newDtoVehicolo
  //       )
  //       .execute();


  //     cardSoccorso.veicolo = vehicoloSave.raw?.insertId;
  //     cardSoccorso.data_inserimento = today;

  //     // Controllo disponibilità di card ss per il dealer e il tipo di card specificati
  //     const disponibilita = await this.disponibilitaPacchettiCardService.findTotalAcquistate(cardSoccorso.dealer, cardSoccorso.tipo_card)
  //     console.log('disponibilita::: ', disponibilita)
  //     // Controllo presenza restituzione in Card S.S.
  //     if (cardSoccorso.restituzione > 0) {
  //       const tipi_restituzione = [0, 'RR', 'RN'];
  //       const tipi_restituzione_contratti = [0, "rest_regionale", "rest_nazionale"];

  //       const valid = await this.disponibilitaPacchettiCardService.findTotalAcquistate(cardSoccorso.dealer, tipi_restituzione[cardSoccorso.restituzione])
  //       if (valid) {
  //         rest_da_pagare = true
  //         prezzo_rest = await this.ordiniContrConsumoCardsService.getPrezzoSoccorso(cardSoccorso.dealer, cardSoccorso.tipo_card, tipi_restituzione_contratti[cardSoccorso.restituzione])
  //       }
  //     }

  //     if (disponibilita > 0) { // // Viene considerata come card da pacchetto
  //       cardSoccorso.id_proforma = 0;
  //     } else { // Viene considerata come card a consumo
  //       card_da_pagare = true;
  //       console.log('Llega aqui')
  //       // Viene letto il prezzo delle card a consumo per il dealer e il tipo card selezionati
  //       prezzo_card = await this.ordiniContrConsumoCardsService.getPrezzoSoccorso(cardSoccorso.dealer, cardSoccorso.tipo_card, cardSoccorso.data_attivazione)
  //     }
  //     // Controllo data del proforma per il dealer selezionato
  //     console.log('prezzo_rest', prezzo_rest)
  //     console.log('rest_da_pagare', rest_da_pagare)
  //     console.log('card_da_pagare', card_da_pagare)
  //     if (card_da_pagare || rest_da_pagare) {
  //       console.log('!dealer.data_proforma_singole_garanzie___ ', !dealer.data_proforma_singole_garanzie)
  //       if (!dealer.data_proforma_singole_garanzie) {
  //         pf_found = await manager.query(
  //           `SELECT * FROM proforma 
  //             WHERE tipo_cliente = ? 
  //             AND id_cliente = ? 
  //             AND tipo_proforma = ? 
  //             AND DATE(data_proforma) = DATE(?)`,
  //           [0, cardSoccorso.dealer, 2, new Date()]);

  //         if (pf_found[0]) {
  //           cardSoccorso.id_proforma = pf_found[0].id
  //           let tot_new_proforma = parseFloat(pf_found[0].importo) +  // Importo precedente Proforma
  //             prezzo_card +          // Importo Card SS
  //             prezzo_rest;           // Importo Restituzione

  //           // Actualiza el importe mostrado en la tabla del proforma
  //           pf_found[0].importo = tot_new_proforma.toFixed(2); // Formatea a dos decimales con un punto como separador
  //           tot_new_proforma = 0;
  //         } else { // Se non trovata ne viene creata una
  //           pf_found = await manager.query(
  //             `INSERT INTO proforma
  //             (tipo_cliente, id_cliente,agente,tipo_proforma, importo, data_inserimento, data_proforma,  data_invio, pagamento__rate, pagamento__differita, pagamento__periodo, is_deleted)
  //             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  //             [0, cardSoccorso.dealer, cardSoccorso.agente, 2, (prezzo_card + prezzo_rest), new Date(), new Date(), new Date(), dealer.pagamento__rate, dealer.pagamento__differita, dealer.pagamento__periodo, false]);
  //         }

  //       } else { // Proforma immediato

  //         pf_found = await manager.query(
  //           `INSERT INTO proforma
  //             (tipo_cliente, id_cliente, agente, tipo_proforma, importo, data_inserimento, data_proforma,  data_invio, pagamento__rate, pagamento__differita, pagamento__periodo, is_deleted)
  //             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  //           [0, cardSoccorso.dealer, cardSoccorso.agente, 2, (prezzo_card + prezzo_rest), new Date(), new Date(), new Date(), dealer.pagamento__rate, dealer.pagamento__differita, dealer.pagamento__periodo, false]);
  //         console.log('pf_found___ ', pf_found[0])
  //         console.log('********************************************')
  //         console.log('Pasa por aqui y crea la proforma')
  //         console.log('********************************************')
  //       }
  //       console.log('pf_found___ ', pf_found)
  //       console.log('card_da_pagare___ ', card_da_pagare)
  //       if (card_da_pagare) cardSoccorso.id_proforma = pf_found.insertId;

  //       if (rest_da_pagare) cardSoccorso.id_proforma_restituzione = pf_found.insertId;

  //     }
  //     console.log('INSERTANDO CARD SOCCORSO: ', cardSoccorso)
  //     id_card_soccorso = await manager
  //       .createQueryBuilder()
  //       .insert()
  //       .into('card_soccorso_2')
  //       .values(
  //         cardSoccorso
  //       )
  //       .execute();
  //   })

  //   if (card_da_pagare || rest_da_pagare) {
  //     await this.proformaService.genPdfProforma(pf_found.insertId);
  //   }
  //   console.log('id_card_soccorso___ ', id_card_soccorso.raw?.insertId)
  //   await this.genPdfCardSoccorso(id_card_soccorso.raw?.insertId)

  //   return result;
  // }

  async create(createCardSoccorsoDto: CreateCardSoccorsoDto | any) {
    const { CardSoccorso: cardSoccorsoData, Veicoli: vehicoloData, Clienti: clientiData } = createCardSoccorsoDto.data;
    console.log('createCardSoccorsoDto.data: ', createCardSoccorsoDto.data)
    // Variables para tracking
    let prezzo_card = 0;
    let prezzo_rest = 0;
    let card_da_pagare = false;
    let rest_da_pagare = false;
    let proformaResult: any;
    let cardSoccorsoId: any;

    return await this.dataSource.transaction(async (manager) => {

      // 2. Preparar datos para Card Soccorso
      const today = new Date();
      const cardSoccorso = {
        ...cardSoccorsoData,
        data_attivazione: today,
        data_scadenza: add(today, { years: 1 }),
        data_inserimento: today,
        stato: 1,
        id_proforma: 0,
        id_proforma_restituzione: 0,
        is_deleted: false
      };
      

      // Si es tipo C, no hay restitución
      if (cardSoccorso.tipo_card === 'C') {
        cardSoccorso.restituzione = 0;
      }

      // 3. Preparar datos del cliente
      const clienti = {
        ...clientiData,
        abilitazione_proforma: false,
        agente: cardSoccorso.agente,
        denominazione: clientiData.denominazione.toUpperCase()
      };

      // 4. Guardar cliente
      const clientiResult = await manager
        .createQueryBuilder()
        .insert()
        .into('clienti')
        .values(clienti)
        .execute();

      const idClient = clientiResult.raw.insertId;

      // 5. Preparar y guardar vehículo
      const vehicolo = {
        ...vehicoloData,
        cliente: idClient,
        targa_originaria: '-',
        immatricolazione: format(vehicoloData.immatricolazione, "yyyy-MM-dd")
      };

      // Procesar marcas y modelos
      const { marcaId, modeloId } = await this.processVehicleBrands(vehicolo, manager);

      // Guardar vehículo
      const { modelo, ...vehicoloToSave } = vehicolo;
      const vehicoloResult = await manager
        .createQueryBuilder()
        .insert()
        .into('veicoli')
        .values(vehicoloToSave)
        .execute();

      // 6. Completar datos de Card Soccorso
      cardSoccorso.veicolo = vehicoloResult.raw.insertId;
      cardSoccorso.proprietario = idClient;

      // 7. Procesar disponibilidad y precios
      const dealer = await this.findDealer(cardSoccorso.dealer);

      // Verificar disponibilidad de card
      const disponibilita = await this.disponibilitaPacchettiCardService.findTotalAcquistate(
        cardSoccorso.dealer,
        cardSoccorso.tipo_card
      );

      // 8. Procesar restitución si aplica
      if (cardSoccorso.restituzione > 0) {
        const tipi_restituzione = [0, 'RR', 'RN'];
        const tipi_restituzione_contratti = [0, "rest_regionale", "rest_nazionale"];

        const valid = await this.disponibilitaPacchettiCardService.findTotalAcquistate(
          cardSoccorso.dealer,
          tipi_restituzione[cardSoccorso.restituzione]
        );

        if (valid) {
          rest_da_pagare = true;
          prezzo_rest = await this.ordiniContrConsumoCardsService.getPrezzoSoccorso(
            cardSoccorso.dealer,
            cardSoccorso.tipo_card,
            tipi_restituzione_contratti[cardSoccorso.restituzione]
          );
        }
      }

      // 9. Verificar si la card es de paquete o a consumo
      if (disponibilita <= 0) {
        card_da_pagare = true;
        prezzo_card = await this.ordiniContrConsumoCardsService.getPrezzoSoccorso(
          cardSoccorso.dealer,
          cardSoccorso.tipo_card,
          cardSoccorso.data_attivazione
        );
      }

      // 10. Crear o actualizar proforma si es necesario
      if (card_da_pagare || rest_da_pagare) {
        proformaResult = await this.handleProforma(
          manager,
          dealer,
          cardSoccorso,
          prezzo_card,
          prezzo_rest
        );

        if (card_da_pagare) {
          cardSoccorso.id_proforma = proformaResult.insertId || proformaResult[0]?.id;
        }

        if (rest_da_pagare) {
          cardSoccorso.id_proforma_restituzione = proformaResult.insertId || proformaResult[0]?.id;
        }
      }

      // 11. Guardar Card Soccorso
      const cardSoccorsoResult = await manager
        .createQueryBuilder()
        .insert()
        .into('card_soccorso_2')
        .values(cardSoccorso)
        .execute();

      cardSoccorsoId = cardSoccorsoResult.raw.insertId;

      return { cardSoccorsoId, proformaId: proformaResult?.insertId };
    }).then(async (result) => {
      // Procesamiento posterior a la transacción
      if ((card_da_pagare || rest_da_pagare) && proformaResult?.insertId) {
        await this.proformaService.genPdfProforma(proformaResult.insertId);
      }

      if (cardSoccorsoId) {
        await this.genPdfCardSoccorso(cardSoccorsoId);
      }

      return result;
    });
  }

  async getCardSoccorso(
    search: Card = {},
    page: number = 1,
    limit: number = 20,
    sort: string = 'id',
    order: 'DESC' | 'ASC' = 'DESC'
  ): Promise<{ card: any[], total: number }> {
    page = Math.max(1, Number(page));
    limit = Math.max(1, Math.min(50, Number(limit)));
    const validOrder = ['DESC', 'ASC'].includes(order) ? order : 'DESC';

    const sortColumn = CardSearchKeys.includes(sort) ? sort : 'id';

    const query = this.entityManager.createQueryBuilder()
      .select('cs.*')
      .from('v_card_soccorso', 'cs')
      .where('cs.is_deleted = 0');

    this.applyFilters(query, search);

    // Obtener el total de registros
    const totalQueryBuilder = query.clone();
    const totalResult = await totalQueryBuilder.select('COUNT(*)', 'total').getRawOne();
    const total = Number(totalResult?.total) || 0;

    // Aplicar ordenación y paginación
    query
      .orderBy(`cs.${sortColumn}`, validOrder as 'ASC' | 'DESC')
      .offset((page - 1) * limit)
      .limit(limit);

    const card = await query.getRawMany();

    return { card, total };
  }

  async findOne(id: number) {
    const [result] = await this.dataSource.query(
      `SELECT *, vm.id as marca,v.marca as marche ,co.provincia FROM card_soccorso_2 g
      JOIN veicoli v ON g.veicolo = v.id
      LEFT JOIN veicoli__modelli vm2 ON v.modello = vm2.id
	    LEFT JOIN veicoli__marche vm ON vm2.marca = vm.id
      JOIN veicoli__tipi vt ON v.tipo = vt.id
      JOIN clienti c ON g.proprietario = c.id
      JOIN comuni co ON c.comune = co.id
      WHERE g.id = ? AND g.is_deleted = 0`,
      [id]
    );

    const formattedResult = {
      card: {
        id: result.id,
        veicolo: result.veicolo,
        proprietario: result.proprietario,
        agente: result.agente,
        dealer: result.dealer,
        venditore: result.venditore,
        data_inserimento: result.data_inserimento,
        data_attivazione: result.data_attivazione,
        data_scadenza: result.data_scadenza,
        id_proforma: result.id_proforma,
        id_proforma_restituzione: result.id_proforma_restituzione,
        tipo_card: result.tipo_card,
        restituzione: result.restituzione,
        stato: result.stato,
        is_deleted: result.is_deleted,
        is_imported: result.is_imported
      },
      veicolo: {
        tipo: result.tipo,
        modello: result.modello,
        cliente: result.cliente,
        cilindrata: result.cilindrata,
        cambio: Number(result.cambio),
        alimentazione: Number(result.alimentazione),
        km: result.km,
        marca: Number(result.marche),
        prima_immatricolazione: result.prima_immatricolazione,
        targa_originaria: result.targa_originaria,
        immatricolazione: result.immatricolazione,
        targa: result.targa,
        codice_qr: result.codice_qr,
        trazione: Number(result.trazione)
      },
      proprietario: {
        nome: result.nome,
        descrizione: result.descrizione,
        tipo_persona: result.tipo_persona,
        abilitazione_proforma: result.abilitazione_proforma,
        denominazione: result.denominazione,
        comune: result.comune,
        cap: result.cap,
        frazione: result.frazione,
        indirizzo: result.indirizzo,
        civico: result.civico,
        cellulare: result.cellulare,
        email: result.email,
        pec: result.pec,
        codfisc_piva: result.codfisc_piva,
        cod_univoco: result.cod_univoco,
        prov: result.provincia
      }
    };

    console.table(formattedResult.card);
    return formattedResult;
  } catch(error) {
    throw new HttpException(
      error.message || 'Si è verificato un errore durante il salvataggio',
      error.status || HttpStatus.INTERNAL_SERVER_ERROR
    );
  }

  async update(idn: number, updateCardSoccorsoDto: any, userId: any) {

    const oldCardSoccorso = await this.findOne(idn);

    const cardSoccorso = updateCardSoccorsoDto.data.CardSoccorso;
    const vehicolo = updateCardSoccorsoDto.data.Veicoli;
    const clienti = updateCardSoccorsoDto.data.Clienti;
    let rest_da_pagare = false;
    let card_da_pagare = false;
    let prezzo_card = 0;
    let prezzo_rest = 0;
    let recalc_tot_proforma = false;
    let pf_found: any
    let proforma_id: any

    const result = await this.dataSource.transaction(async (manager) => {

      const user = await this.validateUser(userId);

      if (user.role !== 'dealer' && user.role !== 'admin') {
        throw new ForbiddenException('No tienes permisos para crear garantías');
      }

      // const modelVehicolo = await manager.query(`SELECT * FROM veicoli WHERE id = ?`, [oldCardSoccorso.veicolo]);

      // const modelClienti = await manager.query(`SELECT * FROM veicoli WHERE id = ?`, [oldCardSoccorso.proprietario]);      
      console.log('vehicolo: ', vehicolo)
      manager.createQueryBuilder()
        .update('veicoli')
        .set(vehicolo)
        .where("id = :id", { id: oldCardSoccorso.card.veicolo })
        .execute();
      console.log('Vihiculo actualizado')

      manager.createQueryBuilder()
        .update('clienti')
        .set(clienti)
        .where("id = :id", { id: oldCardSoccorso.card.proprietario })
        .execute();
      console.log('Cliente  actualizado')

      if (cardSoccorso.tipo_card === 'C') cardSoccorso.restituzione = 0;

      console.log('RESTITUZIONE: ', cardSoccorso.restituzione, cardSoccorso.restituzione > 0)
      console.log('TIPO CARD DISPONIBILITA: ', typeof cardSoccorso.restituzione)
      if (cardSoccorso.restituzione > 0) {
        const tipi_restituzione = [0, 'RR', 'RN'];

        const disponibilita = await this.disponibilitaPacchettiCardService.findTotalAcquistate(cardSoccorso.dealer, tipi_restituzione[cardSoccorso.restituzione])
        console.log('disponibilita: ', disponibilita)
        if (disponibilita) {
          rest_da_pagare = true
          prezzo_rest = await this.ordiniContrConsumoCardsService.getPrezzoSoccorso(cardSoccorso.dealer, tipi_restituzione[cardSoccorso.restituzione], cardSoccorso.data_attivazione)
        }

      }

      console.log('TIPO CARD:', cardSoccorso.tipo_card !== oldCardSoccorso.card.tipo_card)
      if (cardSoccorso.tipo_card !== oldCardSoccorso.card.tipo_card) {
        const disponibilita = await this.disponibilitaPacchettiCardService.findTotalAcquistate(cardSoccorso.dealer, cardSoccorso.tipo_card)
        console.log('disponibilita: ', disponibilita)
        console.log('TIPO CARD DISPONIBILITA: ', typeof disponibilita)
        if (disponibilita > 0) {
          cardSoccorso.id_proforma = 0;
        } else {
          card_da_pagare = true;
          prezzo_card = await this.ordiniContrConsumoCardsService.getPrezzoSoccorso(cardSoccorso.dealer, cardSoccorso.tipo_card, cardSoccorso.data_attivazione)
        }
      }

      console.log('CARD DA PAGARE: ', card_da_pagare)
      console.log('REST DA PAGARE: ', rest_da_pagare)
      if (card_da_pagare || rest_da_pagare) {
        const [dealer] = await manager.query(`SELECT * FROM dealers WHERE id = ?`, [cardSoccorso.dealer])
        console.log('DEALER: ', dealer.data_proforma_singole_garanzie)
        pf_found = await manager.query(`SELECT * FROM proforma WHERE tipo_cliente = 0 AND id_cliente = ? AND tipo_proforma = 2 AND data_proforma = ?`, [cardSoccorso.dealer, format(endOfMonth(new Date()), 'yyyy-MM-dd')]);
        console.log('pf_found: ', pf_found)
        if (!dealer.data_proforma_singole_garanzie) {

          if (!pf_found) {
            pf_found = {
              tipo_cliente: 0,
              id_cliente: cardSoccorso.dealer,
              agente: dealer.agente,
              importo: (Number(prezzo_card) + Number(prezzo_rest)).toFixed(2),
              tipo_proforma: 2,
              data_inserimento: format(new Date(), "yyyy-MM-dd"),
              data_proforma: format(endOfMonth(new Date()), 'yyyy-MM-dd'),
              data_invio: '1900-01-01',
              pagamento__rate: dealer.pagamento__rate,
              pagamento__differita: dealer.pagamento__differita,
              pagamento__periodo: dealer.pagamento__periodo,
              is_deleted: false
            }
            proforma_id = await manager.query(`INSERT INTO proforma SET ?`, [pf_found])
          } else {
            recalc_tot_proforma = true
          }
        } else {
          pf_found = {
            tipo_cliente: 0,
            id_cliente: cardSoccorso.dealer,
            agente: dealer.agente,
            importo: (Number(prezzo_card) + Number(prezzo_rest)).toFixed(2),
            tipo_proforma: 2,
            data_inserimento: format(new Date(), "yyyy-MM-dd"),
            data_proforma: format(new Date(), "yyyy-MM-dd"),
            data_invio: '1900-01-01',
            pagamento__rate: dealer.pagamento__rate,
            pagamento__differita: dealer.pagamento__differita,
            pagamento__periodo: dealer.pagamento__periodo,
            is_deleted: false
          }

          proforma_id = await manager.query(`INSERT INTO proforma SET ?`, [pf_found])
          // manager.createQueryBuilder()
          //   .update('proforma')
          //   .set(pf_found)
          //   .where("id = :id", { id: pf_found.id })
          //   .execute();
        }
        console.log('proforma_id__ ', proforma_id)
        const id_proforma = pf_found === undefined || pf_found.length === 0 ? proforma_id.raw?.insertId : pf_found.id
        if (card_da_pagare) cardSoccorso.id_proforma = id_proforma;
        else cardSoccorso.id_proforma = 0;

        if (rest_da_pagare) cardSoccorso.id_proforma_restituzione = id_proforma;
        else cardSoccorso.id_proforma_restituzione = 0;
      } else {
        cardSoccorso.id_proforma = 0;
        cardSoccorso.id_proforma_restituzione = 0;
      }

      console.log('cardSoccorso___ ', cardSoccorso)
      const { id, venditore, ...newCar } = cardSoccorso
      await manager
        .createQueryBuilder()
        .update('card_soccorso_2')
        .set(newCar)
        .where("id = :id", { id: idn })
        .execute();
    }).catch(error => {
      console.log('error___ ', error)
    })

    const [fatture] = await this.dataSource.query(`
      SELECT * FROM fatture WHERE rif_proforma = ? AND is_deleted = 0
    `, [cardSoccorso.id_proforma])

    const [fatture_rest] = await this.dataSource.query(`
      SELECT * FROM fatture WHERE rif_proforma = ? AND is_deleted = 0
    `, [cardSoccorso.id_proforma])

    console.log('RECALCULO: ', recalc_tot_proforma || !fatture)
    console.log('FACTURA: ', !fatture)
    console.log('FACTURA: ', fatture)
    if (cardSoccorso.id_proforma > 0) {
      if (recalc_tot_proforma || !fatture) {
        await this.proformaService.recalcTotaleProforma(cardSoccorso.id_proforma)
        await this.proformaService.genPdfProforma(cardSoccorso.id_proforma)


        console.log('PRRP: ', cardSoccorso.id_proforma_restituzione !== cardSoccorso.id_proforma && !fatture_rest)
        if (cardSoccorso.id_proforma_restituzione !== cardSoccorso.id_proforma && !fatture_rest) {
          await this.proformaService.recalcTotaleProforma(cardSoccorso.id_proforma_restituzione)
          await this.proformaService.genPdfProforma(cardSoccorso.id_proforma_restituzione)
        }
      }

    }

    await this.genPdfCardSoccorso(idn)

    console.log('PROCESO REALIZADO CON SUCCESSO')

    return result
  }

  async remove(id: number) {
    const result = await this.dataSource
      .createQueryBuilder()
      .update('card_soccorso_2')
      .set({ is_deleted: 1 })
      .where("id = :id", { id })
      .execute();

    if (result.affected === 0) {

      throw new NotFoundException(`Officine with ID ${id} not found`)

    }

    return `Delete complete`;
  }

  tipo_card(value: string) {
    switch (value) {
      case 'C040':
        return '40'
        break;
      case 'C060':
        return '60'
        break;
      case 'C100':
        return '100'
        break;
      case 'CAMPER':
        return 'C'
        break;
      default:
      // code block
    }
  }

  applyFilters(query: SelectQueryBuilder<any>, search: Card): void {
    // Lista de campos válidos para filtrar (excluyendo page y limit)

    const validFields = Object.keys(search).filter(key => !['page', 'limit', 'sort', 'order'].includes(key));

    validFields.forEach(key => {
      const value = search[key];
      if (value !== undefined && value !== null && value !== '') {
        if (value && key === 'data_inserimento' || key === 'data_scadenza' || key === 'data_attivazione') {
          const newValue = JSON.parse(value)
          console.log('newValue: ', newValue)
          const fromDate = newValue.from;
          const toDate = newValue.to;
          query.andWhere(
            `DATE(cs.${key}) BETWEEN :${key}From AND :${key}To`,
            {
              [`${key}From`]: fromDate,
              [`${key}To`]: toDate
            }
          )
        }

        if (key === 'tipo_card' && value !== undefined) {
          query.andWhere(`cs.tipo_card = :${key}`, { [key]: this.tipo_card(value) });
        }

        if (key === 'id' && value !== undefined) {

          query.andWhere(`cs.${key} = :${key}`, { [key]: (Number(value) - 3000) });
        }
        if (typeof value === 'string' && key !== 'data_inserimento' && key !== 'data_attivazione' && key !== 'data_scadenza' && key !== 'id' && key !== 'tipo_card') {

          query.andWhere(`cs.${key} LIKE :${key}`, { [key]: `%${value}%` });
        } else if (typeof value === 'number') {
          console.log(`key: ${key} - value ${value}`)
          query.andWhere(`cs.${key} = :${key}`, { [key]: value });
        }
      }
    });
  }

  private validateUser(email: string): Promise<User | any> {

    const user = this.usersService.findByUsername(email)

    if (!user) throw new NotFoundException('Usuario no encontrado');

    return user;
  }

  private async findDealer(dealerId: any): Promise<any> {
    const [dealer] = await this.entityManager.query(
      'SELECT id, agente, denominazione, data_proforma_singole_garanzie, pagamento__rate, pagamento__differita, pagamento__periodo FROM dealers WHERE id = ?',
      [dealerId]
    );
    if (!dealer) throw new NotFoundException('Dealer no encontrado');
    return dealer;
  }

  private async processVehicleBrands(vehiculo: any, manager: EntityManager) {
    let marcaId = vehiculo.marca;
    let modeloId = vehiculo.modello;

    const marcaHasPrefix = marcaId;
    const modelloHasPrefix = modeloId;

    if (marcaHasPrefix) {
      marcaId = vehiculo.marca;
      const [marca] = await manager.query(
        'SELECT id FROM veicoli__marche WHERE id = ?',
        [marcaId]
      );
      if (!marca) {
        const [newMarca] = await manager.query(
          'INSERT INTO veicoli__marche (nome) VALUES (?)',
          [vehiculo.marca]
        );
        marcaId = newMarca.insertId;
      }
    }

    if (modelloHasPrefix) {
      modeloId = vehiculo.modello
      const [modelo] = await manager.query(
        'SELECT id FROM veicoli__modelli WHERE id = ? AND marca = ?',
        [modeloId, marcaId]
      );
      if (!modelo) {
        const [newModelo] = await manager.query(
          'INSERT INTO veicoli__modelli (nome, marca) VALUES (?, ?)',
          [vehiculo.modello, marcaId]
        );
        modeloId = newModelo.insertId;
      }
    }

    return { marcaId, modeloId };
  }

  async genPdfCardSoccorso(id: any) {
    console.log('id___ ', id);

    // Get card_soccorso data first to extract needed IDs
    const [card_soccorso] = await this.entityManager.query('SELECT * FROM card_soccorso_2 WHERE id = ?', [id]);
    // card_soccorso.id = Number(card_soccorso.id + 15000)
    console.log('card_soccorso___ ', card_soccorso);

    // Run these queries in parallel with Promise.all
    const [
      [dealer],
      [contatto_dealer],
      [client],
      [veicoli]
    ] = await Promise.all([
      this.entityManager.query('SELECT * FROM dealers WHERE id = ?', [card_soccorso.dealer]),
      this.entityManager.query('SELECT * FROM dealers__contatti WHERE dealer = ?', [card_soccorso.dealer]),
      this.entityManager.query('select * from clienti c where c.id = ?', [card_soccorso.proprietario]),
      this.entityManager.query('SELECT * FROM veicoli WHERE id = ?', [card_soccorso.veicolo])
    ]);

    console.log('veicoli___ ', veicoli);

    // Run the second batch of parallel queries
    const [
      [comune_dealer],
      [comune_proprietario],
      [modello_veicolo]
    ] = await Promise.all([
      this.entityManager.query('SELECT * FROM comuni WHERE id = ?', [dealer.comune]),
      this.entityManager.query('SELECT * FROM comuni WHERE id = ?', [client.comune]),
      this.entityManager.query('SELECT * FROM veicoli__modelli WHERE id = ?', [veicoli.modello])
    ]);

    console.log('modello_veicolo___ ', modello_veicolo);

    // Get marca_veicolo
    const [marca_veicolo] = await this.entityManager.query('SELECT nome FROM veicoli__marche WHERE id = ?', [modello_veicolo.marca]);

    const modello_o = modello_veicolo.nome;

    // No need to query veicolo again as it's already stored in 'veicoli'
    const veicolo = veicoli;

    const data = {
      dealer: dealer,
      comune_dealer: comune_dealer,
      comune_proprietario: comune_proprietario,
      card_soccorso: card_soccorso,
      contatto_dealer: contatto_dealer,
      propietario: client,
      modello_veicolo: modello_veicolo,
      marca_veicolo: marca_veicolo,
      modello_o: modello_o,
      veicolo: veicolo
    }

    await this.genPdfService.generateCardSoccorsoPdf('card_soccorso.template', data);
    return 'Garanzia generada y subida con éxito';
  }

  private async handleProforma(manager, dealer, cardSoccorso, prezzo_card, prezzo_rest) {
    const importoTotale = prezzo_card + prezzo_rest;

    if (!dealer.data_proforma_singole_garanzie) {
      // Buscar proforma existente para hoy
      const proformaFound = await manager.query(
        `SELECT * FROM proforma 
       WHERE tipo_cliente = ? 
       AND id_cliente = ? 
       AND tipo_proforma = ? 
       AND DATE(data_proforma) = DATE(?)`,
        [0, cardSoccorso.dealer, 2, new Date()]
      );

      if (proformaFound.length > 0) {
        // Actualizar proforma existente
        const newImporto = parseFloat(proformaFound[0].importo) + importoTotale;
        await manager.query(
          `UPDATE proforma SET importo = ? WHERE id = ?`,
          [newImporto.toFixed(2), proformaFound[0].id]
        );
        return proformaFound;
      }
    }

    // Crear nueva proforma
    return await manager.query(
      `INSERT INTO proforma
     (tipo_cliente, id_cliente, agente, tipo_proforma, importo, 
      data_inserimento, data_proforma, data_invio, 
      pagamento__rate, pagamento__differita, pagamento__periodo, is_deleted)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [0, cardSoccorso.dealer, cardSoccorso.agente, 2, importoTotale,
        new Date(), new Date(), new Date(),
        dealer.pagamento__rate, dealer.pagamento__differita, dealer.pagamento__periodo, false]
    );
  }
}
