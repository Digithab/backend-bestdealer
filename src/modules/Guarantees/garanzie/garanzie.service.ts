import { DisponibilitaPacchettiService } from './../disponibilita_pacchetti/disponibilita_pacchetti.service';
import { ForbiddenException, HttpException, HttpStatus, Injectable, Logger, NotFoundException } from '@nestjs/common';
// import { CreateGaranzieDto } from './dto/create-garanzie.dto';
// import { UpdateGaranzieDto } from './dto/update-garanzie.dto';
import { InjectDataSource, InjectEntityManager } from '@nestjs/typeorm';
import { DataSource, EntityManager, SelectQueryBuilder } from 'typeorm';
import { Garanzie } from './entities/garanzie.entity';
import { Dealer, User, Vehiculo } from 'src/interfaces/interfaces';
import { addDays, addYears, endOfMonth, format, lastDayOfMonth } from 'date-fns';
import { UsersService } from 'src/modules/users/users.service';
import { CreateGarantiaDto } from './dto/create-garantia.dto';
import { ProformaService } from 'src/modules/Fatture/proforma/proforma.service';
import { MailService } from 'src/mail/mail.service';
import { log } from 'console';
import { GenPdfService } from 'src/modules/gen-pdf/gen-pdf.service';

export const GaranzieSearchKeys = [
  'agente',
  'dealer',
  'venditore',
  'garanzie',
  'DDC',
  'soccorso__km',
  'data_inserimento',
  'data_attivazione',
  'data_scadenza',
  'durata',
  'propietario',
  'nome',
  'targa',
  'km',
  'num_guasti',
]

@Injectable()
export class GaranzieService {

  private readonly logger = new Logger(GaranzieService.name);

  vehiculoToExtend: any;

  constructor(

    @InjectEntityManager() private entityManager: EntityManager,

    @InjectDataSource() private dataSource: DataSource,

    private readonly usersService: UsersService,

    private readonly disponibilitaPacchettiService: DisponibilitaPacchettiService,

    private readonly proformaService: ProformaService,
    private readonly mailService: MailService,
    private readonly genPdfService: GenPdfService

  ) { }
  async create(createGarantiaDto: CreateGarantiaDto, extend: any = '0') {

    return await this.dataSource.transaction(async (manager) => {

      let garantiaToExtend = null;

      let garantia = createGarantiaDto.Garanzie

      if (extend !== '0') {

        garantiaToExtend = await this.validateExtension(extend);
      }


      const today = format(new Date(), 'yyyy-MM-dd');

      // Preparar garantía extendida si aplica      
      if (garantiaToExtend) {
        garantia = await this.prepareExtendedGarantia(garantiaToExtend, garantia);

        // Obtener vehículo y propietario originales
        this.vehiculoToExtend = await manager.query(
          'SELECT * FROM veicoli WHERE id = ?',
          [garantiaToExtend.veicolo]
        );

        const propietario = await manager.query(
          'SELECT * FROM clienti WHERE id = ?',
          [garantiaToExtend.proprietario]
        );

        // Preparar nuevos registros
        if (this.vehiculoToExtend[0]) {
          createGarantiaDto.Veicoli = {
            ...this.vehiculoToExtend[0],
            id: undefined,
          };
        }

        if (propietario[0]) {
          createGarantiaDto.Clienti = {
            ...propietario[0],
            id: undefined
          };
        }
      }

      let garanzia_da_pagare = false;
      let soccorso_da_pagare = false;
      let auto_da_pagare = false;
      let notifica_disponibilita = false;

      const vehiculo = createGarantiaDto.Veicoli
      const propietario = createGarantiaDto.Clienti

      let dealer = await this.findDealer(garantia.dealer);


      const { tipo_persona, denominazione, comune, cap, frazione, indirizzo, civico, cellulare, email } = propietario
      const insertedPropietario = await manager.query(
        `INSERT INTO clienti 
        (tipo_persona, denominazione, comune, cap,frazione, indirizzo, agente,civico, cellulare,email)
        VALUES (?, ?, ?, ?, ?,?,?,?,?,?)`,
        [
          1,
          denominazione.toUpperCase(),
          comune,
          cap,
          frazione,
          indirizzo,
          dealer.agente,
          civico,
          cellulare,
          email
        ]
      );

      const propietarioId = insertedPropietario.insertId;
      vehiculo.cliente = propietarioId;

      const { marcaId, modeloId } = await this.processVehicleBrands(vehiculo, manager);

      const newModel = modeloId ?? this.vehiculoToExtend[0].modello

      const { cliente, modello_select, targa, tipo, cilindrata, km, immatricolazione, reimmatricolazione, targa_originaria, prima_immatricolazione, alimentazione, cambio, trazione, codice_qr } = vehiculo

      const insertedVehiculo = await manager.query(
        `INSERT INTO veicoli
        (tipo, modello,cliente, targa, cilindrata, km,  is_deleted, immatricolazione, targa_originaria, prima_immatricolazione, alimentazione, cambio, trazione, codice_qr)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          tipo,
          newModel,
          cliente,
          targa,
          cilindrata,
          km,
          false,
          format(immatricolazione, "yyyy-MM-dd"),
          targa_originaria,
          prima_immatricolazione,
          alimentazione,
          cambio,
          trazione,
          ""
        ]
      );

      const vehiculoId = insertedVehiculo.insertId;

      garantia.veicolo = vehiculoId;
      garantia.proprietario = propietarioId;
      garantia.data_inserimento = today;

      const abonamento = await this.checkSubscriptionAndLimit(garantia)

      const disponibilita = await manager.query(
        'SELECT * FROM v_dealer_disponibilita WHERE dealer = ?',
        [garantia.dealer]
      );

      if (disponibilita === 4) notifica_disponibilita = true;

      const consumo_effettivo = parseInt(String(garantia.durata), 10) / 12;
      if (garantia.soccorso__km > 0) {

        const idSoccorsi: { [key: number]: number } = { 40: 1, 60: 2, 100: 3 };
        // Se nessun soccorso è disponibile da pacchetto, viene considerato come soccorso a consumo
        const disp_soccorso = await this.disponibilitaPacchettiService.getDisponibilitaSoccorso(garantia.dealer, idSoccorsi[garantia.soccorso__km])

        garantia.consumo_pack_soccorso = Math.min(await disp_soccorso, consumo_effettivo)

        if (garantia.consumo_pack_soccorso < consumo_effettivo) soccorso_da_pagare = true;
      }

      if (garantia.soccorso__auto_sostitutiva) {

        const disp_autosost = await this.disponibilitaPacchettiService.getDisponibilita_extras(garantia.dealer, 5)

        garantia.consumo_pack_autosost = Math.min(await disp_autosost, consumo_effettivo)

        if (garantia.consumo_pack_autosost < consumo_effettivo) {
          auto_da_pagare = true
        }
      }

      // Se tipo garanzia = DDC, certificato_conformita è forzato su ON
      if (garantia.tipo_garanzia === 8)
        garantia.certificato_conformita = true;

      // Viene inviata una mail di notifica quando l'attivazione della garanzia fa scendere le rimanenze dai pacchetti sotto 3 garanzie
      // if (disponibilita === 4) notifica_disponibilita = true;

      // Per le garanzie da abbonamento non viene generato il proforma
      if (abonamento)
        garantia.id_proforma = 0;
      else {
        // Viene considerato se generare un proforma


        const [filter_disp] = disponibilita.filter(d => d.prodotto === garantia.tipo_garanzia)

        garantia.consumo_pack = Math.min(Number(!filter_disp || !filter_disp.disponibilidad_total ? 0 : filter_disp.disponibilidad_total), consumo_effettivo);

        if (garantia.consumo_pack < consumo_effettivo) garanzia_da_pagare = true;

      }



      let pf_found
      let insertedProforma
      // Generar proforma

      if (garanzia_da_pagare || soccorso_da_pagare || auto_da_pagare) {
        if (dealer.data_proforma_singole_garanzie) {
          const dataProforma = this.getLastDayOfCurrentMonth();

          pf_found = await manager.query(
            'SELECT * FROM proforma WHERE tipo_cliente = ? AND id_cliente = ? AND tipo_proforma = ? AND data_proforma = ?',
            [0, garantia.dealer, 0, dataProforma])

          if (pf_found.length === 0) {
            pf_found = [0, garantia.dealer, garantia.agente, 0, 0, this.getCurrentDateFormatted(), this.getLastDayOfCurrentMonth(), '1900-01-01', dealer.pagamento__rate, dealer.pagamento__differita, dealer.pagamento__periodo, false]
          }
        } else { // Proforma immediato

          pf_found = [0, garantia.dealer, garantia.agente, 0, 0, this.getCurrentDateFormatted(), this.getCurrentDateFormatted(), '1900-01-01', dealer.pagamento__rate, dealer.pagamento__differita, dealer.pagamento__periodo, false]
        }

        // La proforma viene sovrascritta con i dati aggiornati
        insertedProforma = await manager.query(
          `INSERT INTO proforma
        (tipo_cliente, id_cliente,agente,tipo_proforma, importo, data_inserimento, data_proforma,  data_invio, pagamento__rate, pagamento__differita, pagamento__periodo, is_deleted)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          pf_found)

        // La proforma appena salvata viene associata alla garanzia e se necessario al soccorso
        if (garanzia_da_pagare) garantia.id_proforma = insertedProforma.insertId;
        if (soccorso_da_pagare) garantia.id_proforma_soccorso = insertedProforma.insertId;
        if (auto_da_pagare) garantia.id_proforma_autosost = insertedProforma.insertId;
      }

      // Guardar garantía
      const insertedGarantia = await manager.query(
        `INSERT INTO garanzie
        (data_attivazione, durata, data_scadenza, dealer, agente, tipo_garanzia,
          certificato_conformita, soccorso__km, soccorso__auto_sostitutiva,
          stato, id_proforma, id_proforma_soccorso, id_proforma_autosost, consumo_pack,
          consumo_pack_soccorso, consumo_pack_autosost, is_deleted,
          veicolo, proprietario, data_inserimento, venditore, commento)
        VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          format(garantia.data_attivazione, "yyyy-MM-dd"),
          garantia.durata,
          format(garantia.data_scadenza, "yyyy-MM-dd"),
          garantia.dealer,
          garantia.agente,
          garantia.tipo_garanzia,
          garantia.certificato_conformita,
          garantia.soccorso__km,
          garantia.soccorso__auto_sostitutiva,
          garantia.stato,
          garantia.id_proforma,
          garantia.id_proforma_soccorso,
          garantia.id_proforma_autosost,
          garantia.consumo_pack,
          garantia.consumo_pack_soccorso,
          garantia.consumo_pack_autosost,
          '0',
          garantia.veicolo,
          garantia.proprietario,
          garantia.data_inserimento,
          garantia.venditore === '' ? 0 : garantia.venditore,
          garantia.commento?.toUpperCase() || ''
        ]
      );

      const savedGarantia = { ...garantia, id: insertedGarantia.insertId };
      await manager.query('COMMIT');

      // Recalco la proforma
      if (garanzia_da_pagare || soccorso_da_pagare || auto_da_pagare) {
        await this.proformaService.recalcTotaleProforma(insertedProforma.insertId)
        await this.proformaService.genPdfProforma(insertedProforma.insertId)
      }

      // If para notificar disponibilidad -> notifica_disponibilita
      await this.notificaDisponibilita(garantia.dealer, garantia.agente, dealer.denominazione)
      await this.genPdfGaranzia(savedGarantia.id)

      this.logger.log('Garanzia Creada!!!')
      return savedGarantia;
    });
  }


  async getGaranzie(
    search: any = {},
    page: number = 1,
    limit: number = 500,
    sort: string = 'id',
    order: 'DESC' | 'ASC' = 'DESC'
  ): Promise<{ garanzie: any[], total: number }> {
    page = Math.max(1, Number(page));
    limit = Math.max(1, Math.min(500, Number(limit)));
    const validOrder = ['ASC', 'DESC'].includes(order) ? order : 'DESC'

    //TODO: sortColumn
    const sortColumn = GaranzieSearchKeys.includes(sort) ? sort : 'id'

    const query = this.entityManager.createQueryBuilder()
      .select('vg.*')
      .from('v_garantias', 'vg');

    this.applyFilters(query, search)

    // Obtener el total de registros
    const totalQueeryBuilder = query.clone();
    const totalResult = await totalQueeryBuilder.select('COUNT(*)', 'total').getRawOne();
    const total = Number(totalResult?.total) || 0;

    // Aplicar ordenamiento y paginacion
    query
      .orderBy(`vg.${sortColumn}`, validOrder as 'DESC' | 'ASC')
      .offset((page - 1) * limit)
      .limit(limit)

    const garanzie = await query.getRawMany();

    return { garanzie, total }
  }

  async findOne(id: number) {
    try {
      const [result] = await this.dataSource.query(
        `SELECT g.agente as agent, g.*, v.*, vt.*,c.*, vm.id as marca,
        co.provincia
            FROM garanzie g
            JOIN veicoli v ON g.veicolo = v.id
            LEFT JOIN veicoli__modelli vm2 ON v.modello = vm2.id
            LEFT JOIN veicoli__marche vm ON vm2.marca = vm.id
            LEFT JOIN veicoli__tipi vt ON v.tipo = vt.id
            LEFT JOIN clienti c ON g.proprietario = c.id
            LEFT JOIN comuni co ON c.comune = co.id
            WHERE g.id = ? AND g.is_deleted = 0`,
        [id]
      );

      const formattedResult = {
        garanzie: {
          id: result.id,
          veicolo: result.veicolo,
          proprietario: result.proprietario,
          agente: result.agent,
          dealer: result.dealer,
          venditore: result.venditore,
          tipo_garanzia: result.tipo_garanzia,
          data_inserimento: result.data_inserimento,
          data_attivazione: result.data_attivazione,
          data_scadenza: result.data_scadenza,
          durata: Number(result.durata),
          id_proforma: result.id_proforma,
          id_proforma_soccorso: result.id_proforma_soccorso,
          consumo_pack: result.consumo_pack,
          consumo_pack_soccorso: result.consumo_pack_soccorso,
          consumo_pack_cristallo: result.consumo_pack_cristallo,
          consumo_pack_autosost: result.consumo_pack_autosost,
          cristallo: result.cristallo,
          certificato_conformita: result.certificato_conformita,
          stato: result.stato,
          soccorso__km: result.soccorso__km,
          soccorso__auto_sostitutiva: result.soccorso__auto_sostitutiva,
          id_proforma_autosost: result.id_proforma_autosost,
          id_proforma_cristallo: result.id_proforma_cristallo,
          commento: result.commento,
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
          marca: result.marca,
          prima_immatricolazione: result.prima_immatricolazione,
          targa_originaria: result.targa_originaria,
          immatricolazione: result.immatricolazione,
          targa: result.targa.toUpperCase(),
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
          provincia: result.provincia,
          cap: result.cap,
          frazione: result.frazione,
          indirizzo: result.indirizzo,
          civico: result.civico,
          cellulare: result.cellulare,
          email: result.email,
          pec: result.pec,
          codfisc_piva: result.codfisc_piva,
          cod_univoco: result.cod_univoco
        }
      };


      return formattedResult;
    } catch (error) {
      throw new HttpException(
        error.message || 'Si è verificato un errore durante il salvataggio',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR
      );
    }

  }

  async update(id: number, updateGaranzieDto: any) {
    const proformasToRegenerate: number[] = [];

    const result = await this.dataSource.transaction(async (manager) => {

      // Get existing warranty to compare changes
      const oldWarranty = await manager.query(
        'SELECT * FROM garanzie WHERE id = ?',
        [id]
      );

      if (!oldWarranty[0]) {
        throw new NotFoundException('Garantía no encontrada');
      }

      const today = format(new Date(), 'yyyy-MM-dd');
      let garantia = updateGaranzieDto.Garanzie;
      const vehiculo = updateGaranzieDto.Veicoli;
      const propietario = updateGaranzieDto.Clienti;


      const { marcaId, modeloId } = await this.processVehicleBrands(vehiculo, manager);

      await manager.query(`
        UPDATE veicoli
        SET tipo = ?, 
        modello = ?,         
        cilindrata = ?, 
        cambio = ?, 
        alimentazione = ?, 
        km = ?, 
        prima_immatricolazione='1900-01-01',         
        immatricolazione='2010-03-01', 
        targa = ?, 
        targa_originaria = ?,
        trazione = ?                 
WHERE id = ?;
      `, [
        vehiculo.tipo,
        modeloId,
        vehiculo.cilindrata,
        vehiculo.cambio,
        vehiculo.alimentazione,
        vehiculo.km,
        vehiculo.prima_immatricolazione,
        vehiculo.immatricolazione,
        vehiculo.targa,
        vehiculo.targa_originaria,
        vehiculo.trazione,
        garantia.veicolo
      ])
      await manager.query(`
        UPDATE clienti
        SET tipo_persona = ?,
        agente = ?,
        denominazione = ?,
        comune = ?,
        cap = ?,
        indirizzo = ?,
        civico = ?,
        cellulare = ?,
        email = ?,
        prov = ?
        WHERE id = ?
    `, [
        propietario.tipo_persona,
        garantia.agente,
        propietario.denominazione,
        propietario.comune,
        propietario.cap,
        propietario.indirizzo,
        propietario.civico,
        propietario.cellulare,
        propietario.email,
        propietario.prov,
        garantia.proprietario
      ]);

      // Handle roadside assistance changes
      let garanzia_da_pagare = false;
      let soccorso_da_pagare = false;
      let auto_da_pagare = false;

      if (garantia.soccorso__km !== oldWarranty[0].soccorso__km) {
        if (parseInt(garantia.soccorso__km) === 0) {
          garantia.id_proforma_soccorso = 0;
          garantia.consumo_pack_soccorso = 0;
          if (oldWarranty[0].id_proforma_soccorso) {
            proformasToRegenerate.push(oldWarranty[0].id_proforma_soccorso);
          }
        } else {
          const idSoccorsi: { [key: number]: number } = { 40: 1, 60: 2, 100: 3 };
          const disp_soccorso = await this.disponibilitaPacchettiService.getDisponibilitaSoccorso(
            garantia.dealer,
            idSoccorsi[garantia.soccorso__km]
          );
          if (disp_soccorso === 0) {
            soccorso_da_pagare = true;
          }
        }
      }

      // Check warranty duration changes and package availability
      const disponibilita = await manager.query(
        'SELECT * FROM v_dealer_disponibilita WHERE dealer = ? AND prodotto = ?',
        [garantia.dealer, garantia.tipo_garanzia]
      );

      const consumo_new = parseInt(garantia.durata) / 12;
      const consumo_old = parseInt(oldWarranty[0].durata) / 12;
      const diff_consumo = consumo_new - consumo_old;

      // Handle warranty type changes
      if (parseInt(garantia.tipo_garanzia) !== parseInt(oldWarranty[0].tipo_garanzia)) {
        garantia.consumo_pack = Math.min(disponibilita[0]?.disponibilita || 0, consumo_new);

        if (consumo_new > garantia.consumo_pack) {
          garanzia_da_pagare = true;
        } else {
          if (oldWarranty[0].id_proforma) {
            proformasToRegenerate.push(oldWarranty[0].id_proforma);
          }
          garantia.id_proforma = 0;
        }
      } else {
        // Handle duration changes
        if (diff_consumo > 0) {
          garantia.consumo_pack += Math.min(disponibilita[0]?.disponibilita || 0, diff_consumo);
          if (consumo_new > garantia.consumo_pack) {
            garanzia_da_pagare = true;
          } else {
            if (oldWarranty[0].id_proforma) {
              proformasToRegenerate.push(oldWarranty[0].id_proforma);
            }
            garantia.id_proforma = 0;
          }
        } else if (diff_consumo < 0) {
          if (garantia.consumo_pack > 0) {
            garantia.consumo_pack -= Math.min(-diff_consumo, garantia.consumo_pack);
          }
          if (consumo_new > garantia.consumo_pack) {
            garanzia_da_pagare = true;
          } else {
            garantia.id_proforma = 0;
            if (oldWarranty[0].id_proforma) {
              proformasToRegenerate.push(oldWarranty[0].id_proforma);
            }
          }
        } else if (oldWarranty[0].id_proforma !== 0) {
          garanzia_da_pagare = true;
        }
      }

      // Handle replacement car availability
      if (garantia.soccorso__auto_sostitutiva) {
        const disp_autosost = await this.disponibilitaPacchettiService.getDisponibilita_extras(
          garantia.dealer,
          5
        );

        const oldAutoSost = oldWarranty[0].soccorso__auto_sostitutiva &&
          oldWarranty[0].id_proforma_autosost === 0 ? 1 : 0;

        if ((disp_autosost + oldAutoSost) === 0) {
          auto_da_pagare = true;
        }
      }

      // Generate or update proforma if needed
      if (garanzia_da_pagare || soccorso_da_pagare || auto_da_pagare) {
        const dealer = await this.findDealer(garantia.dealer);
        let proformaId = garantia.id_proforma ||
          garantia.id_proforma_soccorso ||
          garantia.id_proforma_autosost;

        if (!proformaId) {
          const proformaData = dealer.data_proforma_singole_garanzie
            ? format(lastDayOfMonth(new Date()), 'yyyy-MM-dd')
            : format(new Date(), 'yyyy-MM-dd');

          // Check for existing end-of-month proforma
          if (!dealer.data_proforma_singole_garanzie) {
            const existingProforma = await manager.query(
              `SELECT id FROM proforma 
               WHERE tipo_cliente = 0 
               AND id_cliente = ? 
               AND tipo_proforma = 0 
               AND data_proforma = ?`,
              [garantia.dealer, proformaData]
            );

            if (existingProforma[0]) {
              proformaId = existingProforma[0].id;
            }
          }
          if (!proformaId) {
            const newProforma = await manager.query(
              `INSERT INTO proforma
               (tipo_cliente, id_cliente, agente, tipo_proforma, importo,
                data_inserimento, data_proforma, data_invio,
                pagamento__rate, pagamento__differita, pagamento__periodo, is_deleted)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [
                0,
                garantia.dealer,
                garantia.agente,
                0,
                0,
                format(new Date(), 'yyyy-MM-dd'),
                proformaData,
                '1900-01-01',
                dealer.pagamento__rate,
                dealer.pagamento__differita,
                dealer.pagamento__periodo,
                false
              ]
            );
            proformaId = newProforma.insertId;
          }
        }

        if (garanzia_da_pagare) garantia.id_proforma = proformaId;
        if (soccorso_da_pagare) garantia.id_proforma_soccorso = proformaId;
        if (auto_da_pagare) garantia.id_proforma_autosost = proformaId;

        proformasToRegenerate.push(proformaId);
      } else {
        garantia.id_proforma = 0;
        garantia.id_proforma_soccorso = 0;
        garantia.id_proforma_autosost = 0;
      }

      const garantiaLimpia = this.sanitizeGarantia(garantia);

      const update = await manager.query(
        `UPDATE garanzie
   SET
     data_attivazione = ?,
     durata = ?,
     data_scadenza = ?,
     dealer = ?,
     agente = ?,
     tipo_garanzia = ?,
     certificato_conformita = ?,
     soccorso__km = ?,
     soccorso__auto_sostitutiva = ?,
     stato = ?,
     id_proforma = ?,
     id_proforma_soccorso = ?,
     id_proforma_autosost = ?,
     consumo_pack = ?,
     consumo_pack_soccorso = ?,
     consumo_pack_autosost = ?,
     is_deleted = ?,
     veicolo = ?,
     proprietario = ?,
     data_inserimento = ?,
     venditore = ?,
     commento = ?
   WHERE id = ?`,
        [
          format(garantiaLimpia.data_attivazione, "yyyy-MM-dd"),
          garantiaLimpia.durata,
          format(garantiaLimpia.data_scadenza, "yyyy-MM-dd"),
          garantiaLimpia.dealer,
          garantiaLimpia.agente,
          garantiaLimpia.tipo_garanzia,
          garantiaLimpia.certificato_conformita,
          garantiaLimpia.soccorso__km,
          garantiaLimpia.soccorso_auto_sostitutiva, // Ya no necesitamos la verificación aquí
          garantiaLimpia.stato,
          garantiaLimpia.id_proforma,
          garantiaLimpia.id_proforma_soccorso, // Ya no necesitamos la verificación aquí
          garantiaLimpia.id_proforma_autosost, // Ya no necesitamos la verificación aquí
          garantiaLimpia.consumo_pack,
          garantiaLimpia.consumo_pack_soccorso,
          garantiaLimpia.consumo_pack_autosost,
          garantiaLimpia.is_deleted, // Ya no necesitamos la verificación aquí
          garantiaLimpia.veicolo,
          garantiaLimpia.proprietario,
          format(garantiaLimpia.data_inserimento, "yyyy-MM-dd"),
          garantiaLimpia.venditore,
          garantiaLimpia.commento, // Ya está procesado en la función
          id
        ],
      );
      return {
        ...garantia,
        id
      };
    });

    for (const proformaId of [...new Set(proformasToRegenerate)]) {
      if (proformaId !== 0) {
        await this.proformaService.recalcTotaleProforma(proformaId)
        await this.proformaService.genPdfProforma(proformaId)
      }
    }

    await this.genPdfGaranzia(id)

    this.logger.log('Garanzie generado con éxito')
    return result
  }

  async remove(id: number) {
    try {
      await this.dataSource.query(
        `UPDATE garanzie SET is_deleted = 1 WHERE id = ?`,
        [id]
      );
      return { message: 'Garanzie eliminato con successo' };
    } catch (error) {
      throw new HttpException(
        error.message || 'Si è verificato un errore durante il salvataggio',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  async getComment(id: number) {


    const coment = await this.dataSource.query(
      `SELECT commento FROM garanzie WHERE id = ? AND is_deleted = 0`,
      [id]
    );

    return coment[0]
  }

  async newComment(data: any) {


    const { newCommento, newCommentoGaranziaId } = data;

    try {
      // Comprobar existencia de garantía y actualizar comentario en una sola operación
      const result = await this.dataSource.query(
        `UPDATE garanzie 
       SET commento = ? 
       WHERE id = ? AND is_deleted = 0`,
        [newCommento.trim().toUpperCase().substring(0, 250), newCommentoGaranziaId]
      );

      // Verificar si se actualizó alguna fila
      if (result.affectedRows === 0) {
        throw new HttpException(
          'La garanzia richiesta non è stata trovata.',
          HttpStatus.NOT_FOUND
        );
      }

      return { message: 'Commento salvato con successo' };
    } catch (error) {
      throw new HttpException(
        error.message || 'Si è verificato un errore durante il salvataggio del commento.',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  applyFilters(query: SelectQueryBuilder<any>, search: Garanzie): void {
    // Lista de campos válidos para filtrar (excluyendo page y limit)

    const validFields = Object.keys(search).filter(key => !['page', 'limit', 'sort', 'order'].includes(key));
    validFields.forEach(key => {
      const value = search[key];

      if (value !== undefined && value !== null && value !== '') {
        if (value && key === 'data_inserimento' || key === 'data_scadenza' || key === 'data_attivazione') {
          const newValue = JSON.parse(value)
          const fromDate = newValue.from;
          const toDate = newValue.to;
          query.andWhere(
            `DATE(vg.${key}) BETWEEN :${key}From AND :${key}To`,
            {
              [`${key}From`]: fromDate,
              [`${key}To`]: toDate
            }
          )
        }

        if (key === 'id' && value !== undefined && value !== null && value !== '') {
          query.andWhere(`vg.${key} = :${key}`, { [key]: Number(value - 15000) });
        }

        if (key === 'dealer' && value !== undefined && value !== null && value !== '') {
          query.andWhere(`vg.idDealer = :${key}`, { [key]: value });
        }

        if (typeof value === 'string' && key !== 'data_inserimento' && key !== 'data_attivazione' && key !== 'data_scadenza' && key !== 'id' && key !== 'dealer') {
          query.andWhere(`vg.${key} LIKE :${key}`, { [key]: `%${value}%` });
        } else if (typeof value === 'number') {

          query.andWhere(`vg.${key} = :${key}`, { [key]: value });
        }
      }
    });
  }

  private initializeGarantia(today: string, data: any) {
    return {
      data_attivazione: today,
      durata: data.durata,
      data_scadenza: format(addYears(new Date(), 1), 'yyyy-MM-dd'),
      agente: data.agente,
      tipo_garanzia: data.tipo_garanzia,
      veicolo: '',
      proprietario: 0,
      data_inserimento: data.data_inserimento,
      commento: data.commento,
      certificato_conformita: data.certificato_conformita,
      soccorso__auto_sostitutiva: data.soccorso__auto_sostitutiva,
      soccorso__km: data.soccorso__km,
      stato: data.stato,
      venditore: data.venditore,
      id_proforma: 0,
      dealer: 0,
      id_proforma_soccorso: 0,
      id_proforma_autosost: 0,
      consumo_pack: 0,
      consumo_pack_soccorso: 0,
      consumo_pack_autosost: 0,
      is_deleted: false
    };
  }


  private async validateUser(email: string): Promise<User | any> {

    const user = await this.usersService.findByUsername(email)

    if (!user) throw new NotFoundException('Usuario no encontrado');

    const hasModuleAccess = user.permissions.some(permission =>
      permission.startsWith('garanzie:')
    );

    console.log('hasModuleAccess: ', hasModuleAccess)
    if (!hasModuleAccess) {
      throw new ForbiddenException('No tienes acceso al módulo de garanzia');
    }

    return user;
  }

  private async findDealer(dealerId: number): Promise<Dealer> {
    const [dealer] = await this.entityManager.query(
      'SELECT id, agente, denominazione, data_proforma_singole_garanzie, pagamento__rate, pagamento__differita, pagamento__periodo FROM dealers WHERE id = ?',
      [dealerId]
    );
    if (!dealer) throw new NotFoundException('Dealer no encontrado');
    return dealer;
  }

  private async processVehicleBrands(vehiculo: Vehiculo, manager: EntityManager) {
    let marcaId = vehiculo.marca_select;
    let modeloId = vehiculo.modello_select;

    const marcaHasPrefix = typeof marcaId === 'string' && marcaId.startsWith('m__');
    const modelloHasPrefix = typeof modeloId === 'string' && modeloId.startsWith('m__');

    if (marcaHasPrefix) {
      marcaId = vehiculo.marca_select.toString().substring(3);
      const [marca] = await manager.query(
        'SELECT id FROM veicoli__marche WHERE id = ?',
        [marcaId]
      );
      if (!marca) {
        const [newMarca] = await manager.query(
          'INSERT INTO veicoli__marche (nome) VALUES (?)',
          [vehiculo.marca_select.toString().toUpperCase()]
        );
        marcaId = newMarca.insertId;
      }
    }

    if (modelloHasPrefix) {
      modeloId = vehiculo.modello_select.toString().substring(3);
      const [modelo] = await manager.query(
        'SELECT id FROM veicoli__modelli WHERE id = ? AND marca = ?',
        [modeloId, marcaId]
      );
      if (!modelo) {
        const [newModelo] = await manager.query(
          'INSERT INTO veicoli__modelli (nome, marca) VALUES (?, ?)',
          [vehiculo.modello_select.toString().toUpperCase(), marcaId]
        );
        modeloId = newModelo.insertId;
      }
    }

    return { marcaId, modeloId };
  }


  private async validateExtension(garantiaId: number) {
    const garantiaToExtend = await this.dataSource.query(
      `SELECT * FROM garanzie WHERE id = ?`,
      [garantiaId]
    );

    if (!garantiaToExtend[0]) {
      throw new NotFoundException('La garantía a extender no fue encontrada');
    }

    return garantiaToExtend[0];
  }

  // Función para preparar la garantía extendida
  private async prepareExtendedGarantia(garantiaToExtend: any, newGarantia: any) {
    // Copiar datos relevantes de la garantía original
    newGarantia.dealer = garantiaToExtend.dealer;
    newGarantia.agente = garantiaToExtend.agente;
    newGarantia.venditore = garantiaToExtend.venditore;
    newGarantia.tipo_garanzia = garantiaToExtend.tipo_garanzia;

    // Calcular nuevas fechas
    newGarantia.data_attivazione = format(
      addDays(new Date(garantiaToExtend.data_attivazione), 1),
      'yyyy-MM-dd'
    );
    newGarantia.data_scadenza = format(
      addYears(new Date(garantiaToExtend.data_scadenza), 1),
      'yyyy-MM-dd'
    );

    // Copiar configuración de servicios
    newGarantia.soccorso__km = garantiaToExtend.soccorso__km;
    newGarantia.soccorso__auto_sostitutiva = garantiaToExtend.soccorso__auto_sostitutiva;

    // Valores fijos para extensión
    newGarantia.durata = 12;
    newGarantia.certificato_conformita = 0;
    newGarantia.consumo_pack_soccorso = 0;
    newGarantia.is_deleted = 0;
    newGarantia.is_imported = 0;
    newGarantia.stato = 1;
    newGarantia.commento = `Estensione garanzia GR${garantiaToExtend.id + 15000}`;

    return newGarantia;
  }

  async checkSubscriptionAndLimit(model: any): Promise<boolean> {
    const GEST_WARRANTY_TYPES = [4, 5, 6, 7];
    const DDC_WARRANTY_TYPE = 8;

    if ([...GEST_WARRANTY_TYPES, DDC_WARRANTY_TYPE].includes(model.tipo_garanzia)) {
      const abonamento = await this.entityManager.createQueryBuilder()
        .select('oag.*')
        .from('ordini__abbonamenti_garanzie', 'oag')
        .where('oag.dealer = :dealer', { dealer: model.dealer })
        .andWhere('oag.data_inizio_abbonamento > :date', { date: new Date(new Date().setFullYear(new Date().getFullYear() - 1)) })
        .getRawOne()

      if (abonamento) {
        const giornoRinovo = new Date(abonamento.data_inizio_abbonamento).getDate();
        const today = new Date().getDate()
        const lastRenew = new Date(new Date().getFullYear(), today >= giornoRinovo ? new Date().getMonth() : new Date().getMonth() - 1, giornoRinovo);

        // Contar garantías GEST activadas desde el último renovado
        const countGest = await this.entityManager
          .createQueryBuilder()
          .select("COUNT(*)", "g.count")
          .from("garanzie", "g")
          .where("g.tipo_garanzia = 8")
          .andWhere("g.data_attivazione BETWEEN :lastRenew AND :currentDate", {
            lastRenew: lastRenew,
            currentDate: new Date()
          })
          .getRawOne();

        const countDdc = await this.entityManager
          .createQueryBuilder()
          .select("COUNT(*)", "g.count")
          .from("garanzie", "g")
          .where("g.tipo_garanzia = :tipo_garanzia", { tipo_garanzia: 8 })
          .andWhere("g.data_attivazione BETWEEN :lastRenew AND :currentDate",
            {
              lastRenew: lastRenew,
              currentDate: new Date()
            })
          .getRawOne();

        // Comprobar si se pueden crear más garantías
        if ((model.tipo_garanzia === DDC_WARRANTY_TYPE && countDdc.count < abonamento.ddc_qta) ||
          (GEST_WARRANTY_TYPES.includes(model.tipo_garanzia) && countGest.count < abonamento.gest_qta)) {
          return true
        }
      }
    }
  }

  getLastDayOfCurrentMonth(): string {
    const lastDay = endOfMonth(new Date()); // Obtiene el último día del mes actual
    return format(lastDay, 'yyyy-MM-dd'); // Formatea la fecha como YYYY-MM-DD
  }

  getCurrentDateFormatted(): string {
    const currentDate = new Date(); // Obtener la fecha actual
    return format(currentDate, 'yyyy-MM-dd'); // Formatear la fecha en el formato YYYY-MM-DD
  }

  async notificaDisponibilita(dealer: any, agente: any, denominazione: string) {
    const cc: string[] = [];

    const [agenti] = await this.entityManager.query('SELECT email FROM agenti WHERE id = ?', [agente])
    const contatti = await this.entityManager.query('SELECT * FROM dealers__contatti WHERE dealer = ?', [dealer])

    if (agenti) cc.push(agenti.email);

    const prod_acquistati = await this.disponibilitaPacchettiService.getAllProdottiAcquistati()

    const all_disponibilita = await this.entityManager.query('select * from v_dealer_disponibilita WHERE dealer = ?', [dealer])

    const tipi_garanzie = await this.entityManager.query('select * from tipi_garanzie')

    const prodotti = all_disponibilita.map(d => {
      const prod = prod_acquistati.find(p => p.dealer === d.dealer && p.prodotto === d.prodotto)
      return {
        id: d.prodotto,
        denominazione: tipi_garanzie.find(t => t.id === d.prodotto).denominazione,
        cantidad: d.disponibilidad_total,
      }
    })

    contatti.slice(1, 3).forEach(contatto => {
      const email = contatto?.email;
      if (email) cc.push(email);
    });


    await this.mailService.sendGarantiasEmail('aetiru@gmail.com', 'aetiru@gmail.com', 'aetiru@gmail.com', prodotti, denominazione);

  }

  async genPdfGaranzia(id: any) {
    const queries = [
      'SELECT * FROM garanzie WHERE id = ?',
      'SELECT * FROM dealers WHERE id = ?',
      'SELECT * FROM comuni WHERE id = ?',
      'SELECT * FROM dealers__contatti WHERE dealer = ?',
      'SELECT * FROM clienti WHERE id = ?',
      'SELECT * FROM veicoli WHERE id = ?',
      'SELECT * FROM veicoli__modelli WHERE id = ?',
      'SELECT nome FROM veicoli__marche WHERE id = ?',
      'SELECT * FROM dealers__garanzie_abilitate WHERE dealer = ? AND tipo_garanzia = ?'
    ];

    const garanzie = await this.entityManager.query(queries[0], id);
    const dealer = await this.entityManager.query(queries[1], [garanzie[0].dealer]);
    const veicoli = await this.entityManager.query(queries[5], [garanzie[0].veicolo]);
    const modello_veicolo = await this.entityManager.query(queries[6], [veicoli[0].modello]);
    const [
      comune_dealer,
      contatto_dealer,
      client,
      marca_veicolo,
      abilitazione_gr
    ] = await Promise.all([
      this.entityManager.query(queries[2], [dealer[0].comune]),
      this.entityManager.query(queries[3], [garanzie[0].dealer]),
      this.entityManager.query(queries[4], [garanzie[0].proprietario]),
      this.entityManager.query(queries[7], [modello_veicolo[0].marca]),
      this.entityManager.query(queries[8], [garanzie[0].dealer, garanzie[0].tipo_garanzia])
    ]);

    const data = {
      dealer: dealer[0],
      comune_dealer: comune_dealer[0],
      comune_proprietario: await this.entityManager.query('SELECT * FROM comuni WHERE id = ?', [client[0].comune])[0],
      garanzie: { ...garanzie[0], id: Number(garanzie[0].id + 15000) },
      contatto_dealer: contatto_dealer[0],
      propietario: client[0],
      modello_veicolo: modello_veicolo[0],
      marca_veicolo: marca_veicolo[0],
      modello_o: modello_veicolo[0].nome,
      coperture_aggiuntive: abilitazione_gr[0] ? abilitazione_gr[0].coperture_aggiuntive : 0,
      veicolo: veicoli[0]
    };

    await this.genPdfService.generateGaranziePdf('garanzia.template', data)

    this.logger.log('Garanzia generada y subida con éxito')
    return 'Garanzia generada y subida con éxito'
  }

  sanitizeGarantia(g) {
    const now = new Date();
    return {
      ...g,
      data_attivazione: g.data_attivazione ?? now,
      durata: g.durata ?? 0,
      data_scadenza: g.data_scadenza ?? now,
      dealer: g.dealer ?? '',
      agente: g.agente ?? '',
      tipo_garanzia: g.tipo_garanzia ?? '',
      certificato_conformita: g.certificato_conformita ?? '',
      soccorso__km: g.soccorso__km ?? 0,
      soccorso_auto_sostitutiva: g.soccorso_auto_sostitutiva ?? 0,
      stato: g.stato ?? '',
      id_proforma: g.id_proforma ?? 0,
      id_proforma_soccorso: g.id_proforma_soccorso ?? 0,
      id_proforma_autosost: g.id_proforma_autosost ?? 0,
      consumo_pack: g.consumo_pack ?? 0,
      consumo_pack_soccorso: g.consumo_pack_soccorso ?? 0,
      consumo_pack_autosost: g.consumo_pack_autosost ?? 0,
      is_deleted: g.is_deleted ?? 0,
      veicolo: g.veicolo ?? '',
      proprietario: g.proprietario ?? '',
      data_inserimento: g.data_inserimento ?? now,
      venditore: g.venditore ?? '',
      commento: g.commento ? g.commento.toUpperCase() : ''
    };
  }

}
