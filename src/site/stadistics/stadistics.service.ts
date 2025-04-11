import { Injectable } from '@nestjs/common';
import { InjectDataSource, InjectEntityManager } from '@nestjs/typeorm';
import { format } from 'date-fns';
import { DataSource, EntityManager } from 'typeorm';

export enum TimePeriod {
  TODAY = 'oggi',
  WEEK = 'settimana',
  MONTH = 'mese',
  YEAR = 'anno',
}

export interface GarantiaStats {
  tipo_garanzia: number;
  cantidad: number;
  total_venduto: number;
  prezzo_listino: number;
  denominazione: string;
}


@Injectable()
export class StadisticsService {

  constructor(
    @InjectEntityManager() private entityManager: EntityManager,

    @InjectDataSource() private dataSource: DataSource,
  ) { }

  async getTabellaIncidenzeProvider(dealerId: number) {
    const today = format(new Date(), 'yyyy-MM-dd');
    // 
    // Definir los intervalos de fecha  
    const dateRanges = {
      all: { start: '1900-01-01', end: '3000-01-01' },
      '12': {
        start: format(new Date(new Date().setFullYear(new Date().getFullYear() - 1)), 'yyyy-MM-dd'),
        end: today
      },
      '6': {
        start: format(new Date(new Date().setMonth(new Date().getMonth() - 6)), 'yyyy-MM-dd'),
        end: today
      },
      '3': {
        start: format(new Date(new Date().setMonth(new Date().getMonth() - 3)), 'yyyy-MM-dd'),
        end: today
      },
      '1': {
        start: format(new Date(new Date().setMonth(new Date().getMonth() - 1)), 'yyyy-MM-dd'),
        end: today
      },
    };

    // Obtener estadísticas para cada intervalo
    const queries = await Promise.all(
      Object.entries(dateRanges).map(async ([key, dates]) => {
        const stats = await this.getStatisticheDealer(dealerId, dates.start, dates.end);
        return { [key]: stats };
      })
    );

    const resultArray = [];
    const tiposProformaGarantia = ['0', '1', '4', '10', '11', '14'];

    // Procesar los resultados para cada intervalo
    for (const queryResult of queries) {
      const [mesi, interval] = Object.entries(queryResult)[0];

      // Crear objeto para este período
      const periodoData = {
        periodo: mesi,
        tot_venduto: 0,
        tot_venduto_garanzie: 0,
        fatturato_garanzie: 0,
        incasso_garanzie: 0,
        speso_guasti: 0,
        garanzie: {
          total: 0,
          attive: 0,
          scadute: 0,
        },
        soccorsi_venduti: 0,
        soccorsi_aperti: 0,
        auto_sost: 0,
        incidenza_venduto: '0,00',
        incidenza_fatturato: '0,00',
        incidenza_incasso: '0,00'
      };

      // Procesar datos de proforma
      if (interval.proformaData) {
        for (const column of interval.proformaData) {
          const isGaranzia = tiposProformaGarantia.includes(column.tipo_proforma);

          periodoData.tot_venduto += Number(column.venduto || 0);
          if (isGaranzia) {
            periodoData.tot_venduto_garanzie += Number(column.venduto || 0);
            periodoData.fatturato_garanzie += Number(column.fatturato || 0);
            periodoData.incasso_garanzie += Number(column.incasso || 0);
          }
        }
      }

      // Asignar otros valores
      periodoData.speso_guasti = interval.speso_guasti;
      //@ts-ignore
      if (mesi === 'all') {
        periodoData.garanzie = {
          total: Number(interval.garanzie),
          attive: Number(interval.garanzie) - Number(interval.garanzie_scadute),
          scadute: Number(interval.garanzie_scadute),
        };
      } else {
        periodoData.garanzie = {
          total: Number(interval.garanzie),
          attive: Number(interval.garanzie),
          scadute: 0,
        };
      }
      periodoData.soccorsi_venduti = interval.soccorsi_venduti;
      periodoData.soccorsi_aperti = interval.soccorsi_aperti;
      periodoData.auto_sost = interval.auto_sost;

      // Calcular incidencias
      periodoData.incidenza_venduto = this.calculateIncidenza(
        periodoData.speso_guasti,
        periodoData.tot_venduto
      );

      periodoData.incidenza_fatturato = this.calculateIncidenza(
        periodoData.speso_guasti,
        periodoData.fatturato_garanzie
      );

      periodoData.incidenza_incasso = this.calculateIncidenza(
        periodoData.speso_guasti,
        periodoData.incasso_garanzie
      );

      // Añadir el objeto al array
      resultArray.push(periodoData);
    }

    return resultArray;
  }

  private calculateIncidenza(speso: number, total: number): string {
    if (total <= 0) {
      return speso === 0 ? '0,00' : '999,00';
    }
    return (speso / total * 100).toFixed(2).replace('.', ',');
  }


  async getStatisticheDealer(
    dealerId: number,
    startDate: string,
    endDate: string
  ) {
    const queryRunner = this.dataSource.createQueryRunner();

    try {
      await queryRunner.connect();
      await queryRunner.startTransaction();

      // 1. Consulta para proformas y facturas
      const proformaData = await queryRunner.manager
        .createQueryBuilder()
        .select([
          'p.tipo_proforma',
          'SUM(p.importo) as venduto',
          'SUM(f.importo_ft) / 122 * 100 as fatturato',
          'SUM(f.incasso) / 122 * 100 as incasso'
        ])
        .from('proforma', 'p')
        .leftJoin('fatture', 'f', 'f.rif_proforma = p.id')
        .where('p.id_cliente = :dealerId', { dealerId })
        .andWhere('p.tipo_cliente = :tipoCliente', { tipoCliente: 0 })
        .andWhere('p.data_proforma BETWEEN :startDate AND :endDate', {
          startDate,
          endDate
        })
        .groupBy('p.tipo_proforma')
        .getRawMany();

      // 2. Consulta para guasti (averías)
      const speso_guasti = await queryRunner.manager
        .createQueryBuilder()
        .select('COALESCE(SUM(g.costo_dealer), 0)', 'num')
        .from('guasti', 'g')
        .innerJoin('garanzie', 'gar', 'g.garanzia = gar.id')
        .where('gar.dealer = :dealerId', { dealerId })
        .andWhere('gar.is_deleted = :isDeleted', { isDeleted: false })
        .andWhere('g.is_deleted = :isDeleted', { isDeleted: false })
        .andWhere('g.data_guasto BETWEEN :startDate AND :endDate', {
          startDate,
          endDate
        })
        .getRawOne();

      // 3. Consulta para garantías activas
      const garanzie = await queryRunner.manager
        .createQueryBuilder()
        .select('COUNT(*)', 'count')
        .from('garanzie', 'g')
        .where('g.dealer = :dealerId', { dealerId })
        .andWhere('g.data_attivazione BETWEEN :startDate AND :endDate', {
          startDate,
          endDate
        })
        .getRawOne();

      // 4. Consulta para garantías vencidas
      const garanzie_scadute = await queryRunner.manager
        .createQueryBuilder()
        .select('COUNT(*)', 'count')
        .from('garanzie', 'g')
        .where('g.dealer = :dealerId', { dealerId })
        .andWhere('g.data_scadenza <= :today', {
          today: format(new Date(), 'yyyy-MM-dd')
        })
        .getRawOne();

      // 5. Consulta para soccorsi venduti (servicios de asistencia vendidos)
      const soccorsi_venduti = await queryRunner.manager
        .createQueryBuilder()
        .select('COUNT(*)', 'count')
        .from('garanzie', 'g')
        .where('g.dealer = :dealerId', { dealerId })
        .andWhere('g.data_attivazione BETWEEN :startDate AND :endDate', {
          startDate,
          endDate
        })
        .andWhere('g.soccorso__km != :kmValue', { kmValue: 0 })
        .getRawOne();

      // 6. Consulta para soccorsi aperti (servicios de asistencia utilizados)
      const soccorsi_aperti = await queryRunner.manager
        .createQueryBuilder()
        .select('COUNT(*)', 'count')
        .from('soccorsi', 'ss')
        .leftJoin('garanzie', 'g', 'ss.is_cs = 0 AND ss.garanzia = g.id')
        .leftJoin('card_soccorso', 'cs', 'ss.is_cs = 1 AND ss.garanzia = cs.id')
        .where('(g.dealer = :dealerId OR cs.cliente = :dealerId)', { dealerId })
        .andWhere('ss.data_fermo BETWEEN :startDate AND :endDate', {
          startDate,
          endDate
        })
        .getRawOne();

      // 7. Consulta para auto sostitutive (autos de sustitución)
      const auto_sost = await queryRunner.manager
        .createQueryBuilder()
        .select('COUNT(*)', 'count')
        .from('garanzie', 'g')
        .where('g.dealer = :dealerId', { dealerId })
        .andWhere('g.soccorso__auto_sostitutiva = :value', { value: true })
        .andWhere('g.data_attivazione BETWEEN :startDate AND :endDate', {
          startDate,
          endDate
        })
        .getRawOne();

      await queryRunner.commitTransaction();

      return {
        proformaData,
        speso_guasti: Number(speso_guasti?.num || 0),
        garanzie: Number(garanzie?.count || 0),
        garanzie_scadute: Number(garanzie_scadute?.count || 0),
        soccorsi_venduti: Number(soccorsi_venduti?.count || 0),
        soccorsi_aperti: Number(soccorsi_aperti?.count || 0),
        auto_sost: Number(auto_sost?.count || 0)
      };

    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async getGarantiaStats(period: TimePeriod = TimePeriod.TODAY): Promise<GarantiaStats[]> {
    // Construir la condición de fecha basada en el periodo seleccionado
    let dateCondition: string;

    console.log('period___ ', period)

    switch (period) {
      case TimePeriod.TODAY:
        dateCondition = `DATE(g.data_inserimento) = CURDATE()`;
        break;
      case TimePeriod.WEEK:
        dateCondition = `g.data_inserimento >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)`;
        break;
      case TimePeriod.MONTH:
        dateCondition = `g.data_inserimento >= DATE_SUB(CURDATE(), INTERVAL 1 MONTH)`;
        break;
      case TimePeriod.YEAR:
        dateCondition = `g.data_inserimento >= DATE_SUB(CURDATE(), INTERVAL 1 YEAR)`;
        break;
      default:
        dateCondition = `DATE(g.data_inserimento) = CURDATE()`;
    }

    // Consulta SQL con el filtro de fecha
    const query = `
      SELECT 
        g.tipo_garanzia, 
        COUNT(*) AS cantidad, 
        (tg.prezzo_listino * COUNT(*)) AS total_venduto, 
        tg.prezzo_listino, 
        tg.denominazione
      FROM garanzie g
      JOIN tipi_garanzie tg ON g.tipo_garanzia = tg.id
      WHERE ${dateCondition}
      GROUP BY g.tipo_garanzia
      ORDER BY tg.id ASC
    `;

    // Ejecutar la consulta
    const result = await this.dataSource.query(query);
    return result;
  }

  // Método para obtener el total de ventas por periodo
  async getTotalSales(period: TimePeriod = TimePeriod.TODAY): Promise<number> {
    const stats = await this.getGarantiaStats(period);
    return stats.reduce((total, item) => total + Number(item.total_venduto), 0);
  }




}
