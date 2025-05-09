import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { InjectEntityManager } from '@nestjs/typeorm';
import { Response } from 'express';
import * as Excel from 'exceljs';
import * as fs from 'fs';
import * as path from 'path';
import * as ExcelJS from 'exceljs';

interface CommissionRates {
  best: number;
  gest: number;
  ddc: number;
  addons: number;
  other: number;
  cards: number;
}

interface Revenue {
  best: number;
  gest: number;
  ddc: number;
  addons: number;
  other: number;
  cards: number;
}

@Injectable()
export class ReportsService {



  private readonly logger = new Logger(ReportsService.name);

  private meses = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
    'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre']

  constructor(

    @InjectEntityManager() private entityManager: EntityManager,

  ) { }

  async agentiReport(id: number, mese: number, anno: number, res: Response) {

    if (mese < 1 || mese > 12 || !String(anno).match(/^\d{4}$/)) {

      throw new NotFoundException('Parametri non validi');

    }

    let agenti: any


    agenti = await this.entityManager.query('SELECT * FROM agenti WHERE id = ?',
      [id]);

    if (!agenti) {
      throw new NotFoundException('Agente non trovato');
    }

    const fileName = `${this.meses[mese - 1]} ${anno} - ${agenti.denominazione}.xlsx`;
    const meseFormatted = String(mese).padStart(2, '0');
    const concatAnnoMese = `${anno}${meseFormatted}`;

    if (parseInt(concatAnnoMese) < 202106) {
      const legacyPath = path.join(__dirname, '..', '..', 'storage', 'reports_legacy', agenti.sigla, `${anno}.${meseFormatted}.xls`);
      if (fs.existsSync(legacyPath)) {
        return res.download(legacyPath, fileName);
      } else {
        throw new NotFoundException("Il file non esiste: è possibile che l'agente non fosse attivo nella data specificata.");
      }
    }

    const proforma = this.entityManager.createQueryBuilder()
      .select('pr.*')
      .from('proforma', 'pr')
      .where(`pr.agente = ${id}`)
      .andWhere('tipo_proforma < 10')
      .andWhere(`data_proforma BETWEEN '${anno}-${meseFormatted}-01' AND LAST_DAY('${anno}-${meseFormatted}-01')`)

    // Crear y configurar el workbook de Excel
    const workbook = new Excel.Workbook();
    const worksheet = workbook.addWorksheet(`${this.meses[mese - 1]} ${anno}`);

    // Aquí iría la lógica para añadir filas y dar formato basado en el contenido HTML
    // Por ejemplo:
    worksheet.addRow(['Agente', 'Mese', 'Anno']);
    worksheet.addRow([agenti.denominazione, this.meses[mese - 1], anno]);
    // ... más filas según sea necesario

    // Ajustar anchos de columna
    worksheet.getColumn('B').width = 15;
    worksheet.getColumn('C').width = 20;
    worksheet.getColumn('D').width = 15;
    worksheet.getColumn('X').width = 15;

    const tmpPath = path.join(__dirname, '..', '..', 'tmp');
    if (!fs.existsSync(tmpPath)) {
      fs.mkdirSync(tmpPath, { recursive: true });
    }

    const filePath = path.join(tmpPath, fileName);
    await workbook.xlsx.writeFile(filePath);

    res.download(filePath, fileName, (err) => {
      if (err) {
        console.error('Error al enviar el archivo:', err);
      }
      // Eliminar el archivo temporal después de enviarlo
      fs.unlinkSync(filePath);
    });


    return `This action returns all reports`;
  }

  async getAllReport(
    page: number = 1,
    limit: number = 10,
    denominazione?: string,
    sigla?: string,
    anno?: string,
    dealer?: string
  ) {
    try {
      // Ensure numbers are valid
      const validPage = Math.max(1, Number(page));
      const validLimit = Math.max(1, Number(limit));
      const offset = (validPage - 1) * validLimit;

      // Build the WHERE clause dynamically
      const whereConditions = [];
      const params: any = [];

      if (denominazione) {
        whereConditions.push("denominazione LIKE ?");
        params.push(`%${denominazione}%`);
      }

      if (dealer) {
        whereConditions.push("dealer = ?");
        params.push(`${dealer}`);
      }

      if (sigla) {
        whereConditions.push("sigla LIKE ?");
        params.push(`%${sigla}%`);
      }

      if (anno) {
        whereConditions.push("anno LIKE ?");
        params.push(`%${anno}%`);
      }

      const whereClause = whereConditions.length > 0
        ? `WHERE ${whereConditions.join(' AND ')}`
        : '';

      // Get total count for pagination
      const [totalCount] = await this.entityManager.query(
        `select COUNT(*) as total from v_report_dealer
         ${whereClause}`,
        params
      );

      // Main query with pagination
      const query = `
        select * from v_report_dealer
        ${whereClause}                
        LIMIT ${validLimit} OFFSET ${offset}
      `;

      const results = await this.entityManager.query(query, params);
      console.log('totalCount___ ', totalCount.total)
      return {
        data: results,
        pagination: {
          total: parseInt(totalCount.total),
          page: validPage,
          limit: validLimit,
          totalPages: Math.ceil(parseInt(totalCount.total) / validLimit),
        },
      };
    } catch (error) {
      this.logger.error('Error calculating disponibilita', error.stack);
      throw error;
    }
  }

  async calculateAgentCommissions(agentId: number, month: string, year: string) {
    // Get agent commission rates - no change needed here
    const agent = await this.entityManager.query(`
    SELECT
      provvigioni__best as best,
      provvigioni__gest as gest,
      provvigioni__ddc as ddc,
      provvigioni__addons as addons,
      provvigioni__altro as other,
      provvigioni__cards as cards,
      denominazione as name
    FROM agenti
    WHERE id = ?
  `, [agentId]);

    // Get all proformas for the agent in given month/year
    const proformas = await this.entityManager.query(`
    SELECT
        p.id,
        p.tipo_proforma as type,
        p.id_cliente as clientId,
        p.tipo_cliente as clientType,
        p.data_proforma as date
      FROM proforma p
      WHERE p.agente = ?
        AND MONTH(p.data_proforma) = ?
        AND YEAR(p.data_proforma) = ?
  `, [agentId, month, year]);

    console.log('proformas___ ', proformas)


    // Extraer todos los IDs de clientes únicos
    const clientIds = [...new Set(proformas.map(p => p.clientId))];
    const clientTypes = [...new Set(proformas.map(p => p.clientType))];

    console.log('clientIds___ ', clientIds)
    console.log('clientTypes___ ', clientTypes)
    // Cargar información de todos los clientes en una sola consulta
    const clients = await this.loadClientsInBatch(clientIds, clientTypes);


    // Procesar todas las proformas en paralelo
    const resultsPromises = proformas.map(async proforma => {
      const revenue = await this.calculateRevenue(proforma);
      const commissions = this.calculateCommissionAmount(revenue, agent[0]);

      // Buscar cliente en caché en lugar de hacer una consulta
      const clientKey = `${proforma.clientId}_${proforma.clientType}`;
      const client = clients[clientKey] || {};

      return {
        proformaId: proforma.id,
        type: this.getProformaType(proforma.type),
        client: client.denominazione || '',
        date: proforma.date,
        commissionRates: agent[0],
        revenue,
        commissions,
        totalRevenue: this.calculateTotal(revenue),
        totalCommission: this.calculateTotal(commissions)
      };
    });

    const results = await Promise.all(resultsPromises);

    return {
      agentName: agent[0].name,
      month,
      year,
      details: results,
      summary: this.calculateSummary(results)
    };
  }

  // Método para cargar clientes en lote
  async loadClientsInBatch(clientIds, clientTypes) {
    // Crear una consulta parametrizada dinámica basada en los IDs disponibles
    // Este es un enfoque simplificado, podrías necesitar ajustar según tu esquema
    if (clientIds.length === 0) return {};

    const placeholders = clientIds.map(() => '?').join(',');
    const clients = await this.entityManager.query(`
    SELECT id, tipo_persona, denominazione
    FROM clienti
    WHERE id IN (${placeholders})
  `, [...clientIds]);

    // Crear un mapa para acceso rápido
    const clientMap = {};
    clients.forEach(client => {
      clientMap[`${client.id}_${client.tipo_persona}`] = client;
    });

    return clientMap;
  }

  private async calculateRevenue(proforma: any): Promise<Revenue> {
    const revenue = {
      best: 0,
      gest: 0,
      ddc: 0,
      addons: 0,
      other: 0,
      cards: 0
    };

    switch (proforma.type) {
      case 0: // Warranties
        const warranties = await this.entityManager.query(`
          SELECT * FROM garanzie 
          WHERE id_proforma = ?
        `, [proforma.id]);

        for (const warranty of warranties) {
          const price = await this.getWarrantyPrice(
            warranty.dealer,
            warranty.tipo_garanzia,
            warranty.data_attivazione
          );

          if (warranty.tipo_garanzia <= 3) {
            revenue.best += price * (parseInt(warranty.durata) / 12);
          } else if (warranty.tipo_garanzia <= 7) {
            revenue.gest += price * (parseInt(warranty.durata) / 12);
          } else {
            revenue.ddc += price * (parseInt(warranty.durata) / 12);
          }
        }
        break;

      case 1: // Warranty Packs
        const packProducts = await this.entityManager.query(`
          SELECT pq.*, p.id_proforma
          FROM ordini__prodotti_quantita pq
          INNER JOIN ordini__pacchetti p ON pq.ordine = p.id
          WHERE p.id_proforma = ? AND pq.is_deleted = false
        `, [proforma.id]);

        for (const product of packProducts) {
          const amount = product.prezzo_netto * product.quantita;
          switch (product.prodotto) {
            case 1:
            case 2:
            case 3:
              product.is_extra ?
                revenue.addons += amount :
                revenue.best += amount;
              break;
            case 4:
              revenue.gest += amount;
              break;
            case 5:
            case 6:
            case 7:
              product.is_extra ?
                revenue.addons += amount :
                revenue.gest += amount;
              break;
            case 8:
              revenue.ddc += amount;
              break;
          }
        }
        break;

      case 2: // Assistance Cards
        const cards = await this.entityManager.query(`
          SELECT * FROM card_soccorso_2
          WHERE id_proforma = ?
        `, [proforma.id]);

        for (const card of cards) {
          revenue.cards += await this.getCardPrice(
            card.dealer,
            card.tipo_card,
            card.data_attivazione
          );
        }
        break;

      // Add other cases as needed
    }

    return revenue;
  }

  private calculateCommissionAmount(revenue: Revenue, rates: CommissionRates) {
    return {
      best: revenue.best * (rates.best / 100),
      gest: revenue.gest * (rates.gest / 100),
      ddc: revenue.ddc * (rates.ddc / 100),
      addons: revenue.addons * (rates.addons / 100),
      other: revenue.other * (rates.other / 100),
      cards: revenue.cards * (rates.cards / 100)
    };
  }

  private async getClientInfo(clientId: number, clientType: number) {
    const table = clientType === 0 ? 'dealers' : 'clienti';
    const [client] = await this.entityManager.query(`
      SELECT denominazione FROM ${table} WHERE id = ?
    `, [clientId]);

    return client || { denominazione: null };;
  }

  private async getWarrantyPrice(dealer: number, type: any, date: string) {
    const contract = await this.getPrezzoGaranzia(dealer, type, date);
    return contract || 0;
  }

  private async getCardPrice(dealer: number, type: string, date: string) {
    const [contract] = await this.entityManager.query(`
      SELECT prezzo_card 
      FROM ordini__contratti_a_consumo_cardss 
      WHERE dealer = ? 
        AND ? BETWEEN data_inizio_contratto AND data_fine_contratto
    `, [dealer, date]);
    return contract?.prezzo_card || 0;
  }

  private calculateTotal(obj: Record<string, any>): any {
    return Object.values(obj).reduce((sum, val) => sum + val, 0);
  }

  private getProformaType(type: number): string {
    const types = {
      0: 'Garanzie',
      1: 'Pack Garanzie',
      2: 'Card SS',
      3: 'Pack Card SS',
      4: 'Abbonamenti',
      5: 'Libere'
    };
    return types[type] || 'Unknown';
  }

  private calculateSummary(results: any[]) {
    const totals = {
      revenue: {
        best: 0,
        gest: 0,
        ddc: 0,
        addons: 0,
        other: 0,
        cards: 0,
        total: 0
      },
      commission: {
        total: 0
      }
    };

    results.forEach(result => {
      Object.keys(result.revenue).forEach(key => {
        totals.revenue[key] += result.revenue[key];
      });
      totals.revenue.total += result.totalRevenue;
      totals.commission.total += result.totalCommission;
    });

    return totals;
  }

  async generateExcel(data: any, res: Response) {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Provvigioni');

    // Configurar ancho de columnas
    worksheet.columns = [
      { width: 8 },  // N.
      { width: 15 }, // Tipo
      { width: 30 }, // Dealer
      { width: 12 }, // Data
      { width: 10 }, // BEST %
      { width: 10 }, // GEST %
      { width: 10 }, // DDC %
      { width: 10 }, // ADDONS %
      { width: 10 }, // ALTRO %
      { width: 10 }, // CARD SS %
      { width: 12 }, // BEST €
      { width: 12 }, // GEST €
      { width: 12 }, // DDC €
      { width: 12 }, // ADDONS €
      { width: 12 }, // ALTRO €
      { width: 12 }, // CARD SS €
      { width: 12 }, // TOTALE
      { width: 12 }, // BEST Mat
      { width: 12 }, // GEST Mat
      { width: 12 }, // DDC Mat
      { width: 12 }, // ADDONS Mat
      { width: 12 }, // ALTRO Mat
      { width: 12 }, // CARD SS Mat
      { width: 12 }, // Tot Maturato
    ];

    // Título
    worksheet.mergeCells('A1:X1');
    const titleCell = worksheet.getCell('A1');
    titleCell.value = `PROVVIGIONI AGENTE ${data.agentName}: ${data.month.toUpperCase()} ${data.year}`;
    titleCell.font = { size: 14, bold: true };
    titleCell.alignment = { horizontal: 'center' };

    // Grupos de columnas
    worksheet.mergeCells('E2:J2');
    worksheet.mergeCells('K2:Q2');
    worksheet.mergeCells('R2:W2');

    const groups = [
      { cell: 'E2', text: 'Provvigioni (%)', color: 'FFC000' },
      { cell: 'K2', text: 'Fatturato', color: '92D050' },
      { cell: 'R2', text: 'Provvigioni Maturate', color: '00B0F0' },
      { cell: 'X2', text: 'Tot. Maturato', color: 'FF3300' }
    ];

    groups.forEach(({ cell, text, color }) => {
      const groupCell = worksheet.getCell(cell);
      groupCell.value = text;
      groupCell.font = { bold: true };
      groupCell.alignment = { horizontal: 'center' };
      groupCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: color }
      };
    });

    // Encabezados
    const headers = [
      'N.', 'Tipo', 'Dealer', 'Data',
      'BEST', 'GEST', 'DDC', 'ADDONS', 'ALTRO', 'CARD SS',
      'BEST', 'GEST', 'DDC', 'ADDONS', 'ALTRO', 'CARD SS', 'TOTALE',
      'BEST', 'GEST', 'DDC', 'ADDONS', 'ALTRO', 'CARD SS',
      'Tot. Maturato'
    ];

    const headerRow = worksheet.getRow(3);
    headers.forEach((header, i) => {
      const cell = headerRow.getCell(i + 1);
      cell.value = header;
      cell.font = { bold: true };
      cell.alignment = { horizontal: 'center' };

      // Aplicar colores de fondo según grupo
      if (i >= 4 && i <= 9) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFC000' } };
      else if (i >= 10 && i <= 16) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '92D050' } };
      else if (i >= 17 && i <= 22) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '00B0F0' } };
      else if (i === 23) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF3300' } };
    });

    // Datos
    data.details.forEach((item, index) => {
      const rowNumber = index + 4;
      const row = worksheet.getRow(rowNumber);

      // Datos básicos
      row.getCell(1).value = item.proformaId;
      row.getCell(2).value = item.type;
      row.getCell(3).value = item.client;
      row.getCell(4).value = new Date(item.date);
      row.getCell(4).numFmt = 'dd/mm/yyyy';

      // Porcentajes de comisión
      row.getCell(5).value = item.commissionRates.best;
      row.getCell(6).value = item.commissionRates.gest;
      row.getCell(7).value = item.commissionRates.ddc;
      row.getCell(8).value = item.commissionRates.addons;
      row.getCell(9).value = item.commissionRates.other;
      row.getCell(10).value = item.commissionRates.cards;

      // Valores de facturación
      row.getCell(11).value = item.revenue.best;
      row.getCell(12).value = item.revenue.gest;
      row.getCell(13).value = item.revenue.ddc;
      row.getCell(14).value = item.revenue.addons;
      row.getCell(15).value = item.revenue.other;
      row.getCell(16).value = item.revenue.cards;

      // Fórmulas para totales y comisiones
      row.getCell(17).value = { formula: `SUM(K${rowNumber}:P${rowNumber})` };

      // Fórmulas para comisiones calculadas
      row.getCell(18).value = { formula: `K${rowNumber}*E${rowNumber}/100` };
      row.getCell(19).value = { formula: `L${rowNumber}*F${rowNumber}/100` };
      row.getCell(20).value = { formula: `M${rowNumber}*G${rowNumber}/100` };
      row.getCell(21).value = { formula: `N${rowNumber}*H${rowNumber}/100` };
      row.getCell(22).value = { formula: `O${rowNumber}*I${rowNumber}/100` };
      row.getCell(23).value = { formula: `P${rowNumber}*J${rowNumber}/100` };

      // Total maturado
      row.getCell(24).value = { formula: `SUM(R${rowNumber}:W${rowNumber})` };

      // Alineación central para todas las celdas numéricas
      for (let i = 4; i <= 24; i++) {
        row.getCell(i).alignment = { horizontal: 'center' };
      }
    });

    // Fila de totales
    const lastRow = data.details.length + 4;
    const totalRow = worksheet.getRow(lastRow);

    // Estilo para la línea superior de totales
    for (let i = 1; i <= 24; i++) {
      const cell = totalRow.getCell(i);
      cell.border = {
        top: { style: 'thin' }
      };
    }

    totalRow.getCell(3).value = 'Totali';
    totalRow.getCell(3).font = { bold: true };

    // Fórmulas de suma para totales
    const columns = ['K', 'L', 'M', 'N', 'O', 'P', 'Q'];
    columns.forEach((col, i) => {
      totalRow.getCell(11 + i).value = {
        formula: `SUM(${col}4:${col}${lastRow - 1})`
      };
    });

    totalRow.getCell(24).value = {
      formula: `SUM(X4:X${lastRow - 1})`
    };

    // Configurar la respuesta HTTP
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=provvigioni_${data.agentName}_${data.month}_${data.year}.xlsx`
    );

    // Devolver el archivo Excel
    await workbook.xlsx.write(res);
  }

  async getPrezzoGaranzia(dealer: any, tipo_garanzia: string, data: any) {
    const queryResult = await this.entityManager
      .createQueryBuilder()
      .select('ocacc.prezzo_unitario', 'prz')
      .from('ordini__contratti_a_consumo', 'occ')
      .innerJoin('ordini__contratti_a_consumo__quantita', 'ocacc', 'ocacc.contratto = occ.id')
      .where('ocacc.garanzia = :tipo_garanzia', { tipo_garanzia })
      .andWhere('occ.dealer = :dealer', { dealer })
      .andWhere('occ.is_deleted = :is_deleted', { is_deleted: false })
      .andWhere(':data BETWEEN occ.data_inizio_contratto AND occ.data_fine_contratto', { data })
      .getRawOne();

    if (!queryResult) {
      // Equivalente a findOne del tipo de garantía
      const tipoGaranzia = await await this.entityManager
        .createQueryBuilder()
        .select('tg.prezzo_listino', 'prz')
        .from('tipi_garanzie', 'tg')
        .where('tg.id = :tipo_garanzia', { tipo_garanzia })
        .getRawOne();

      console.log('tipoGaranzia___ ', tipoGaranzia)
      console.log('tipoGaranzia?.prezzo_listino__ ', tipoGaranzia?.prezzo_listino)
      return Number(tipoGaranzia?.prezzo_listino);
    } else {
      return Number(queryResult.prz)
    }
  }
}
