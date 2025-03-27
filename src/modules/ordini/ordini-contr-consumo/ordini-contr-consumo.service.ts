import { forwardRef, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { CreateOrdiniContrConsumoDto } from './dto/create-ordini-contr-consumo.dto';
import { UpdateOrdiniContrConsumoDto } from './dto/update-ordini-contr-consumo.dto';
import { DataSource, EntityManager, SelectQueryBuilder } from 'typeorm';
import { InjectDataSource, InjectEntityManager } from '@nestjs/typeorm';
import { User } from 'src/interfaces/interfaces';
import { UsersService } from 'src/modules/users/users.service';
import { ProformaService } from 'src/modules/Fatture/proforma/proforma.service';
import { ContrattoSearch } from './interface/ordini-contr-consumo.interface';
import { format } from 'date-fns';

export const ContrattoSearchKeys = [
  'id_dealer',
  'dealer',
  'data_inizio_co',
  'data_fine_cont',
  'id',
  'best_a',
  'best_b',
  'best_c',
  'gest_a',
  'gest_b',
  'gest_c',
  'gest_d',
  'ddc',
  'soccorso_40km',
  'soccorso_60km',
  'soccorso_100km',
  'auto_sost'
]

@Injectable()
export class OrdiniContrConsumoService {

  constructor(

    @InjectEntityManager() private entityManager: EntityManager,

    @InjectDataSource() private dataSource: DataSource,

    private usersService: UsersService,

    @Inject(forwardRef(() => ProformaService))
    private proformaService: ProformaService

  ) { }

  async create(createOrdiniContrConsumoDto: any, userId: string) {
    const user = await this.validateUser(userId);

    if (user.role !== 'admin') return

    const model = createOrdiniContrConsumoDto

    model.data_inserimento = format(new Date(), 'yyyy-MM-dd');


    const { agente, quantita, contratto, ...filteredModel } = model;
    return await this.dataSource.transaction(async (manager) => {

      const is_saved = await manager
        .createQueryBuilder()
        .insert()
        .into('ordini__contratti_a_consumo')
        .values(
          filteredModel
        )
        .execute();


      if (is_saved) {

        const garanzia_abilit = await manager.query('SELECT * FROM dealers__garanzie_abilitate WHERE dealer = ? AND attivo = 1', [model.dealer])
        const tipi = await manager.query('SELECT dga.id FROM dealers__garanzie_abilitate dga WHERE dealer = ? AND attivo = 1', [model.dealer])
        // Iterazione su ogni garanzia a cui il dealer è abilitato
        let index = 0;
        for (let garanzia of garanzia_abilit) {
          // Viene creata la row per la tabella ordini__contratti_a_consumo__quantita
          const productKey = tipi[index].id;
          console.log('productKey___ ', productKey)
          console.log('model.quantita___ ', model.quantita)
          const { prezzo_netto } = model.quantita[`${productKey}`]

          await manager
            .createQueryBuilder()
            .insert()
            .into('ordini__contratti_a_consumo__quantita') // Assuming a 'log' table
            .values({
              contratto: is_saved.raw?.insertId,
              garanzia: garanzia.tipo_garanzia,
              prezzo_unitario: prezzo_netto,
            })
            .execute();

          index++
        }

        // Ricalcolo proforma non fatturati
        const proforma_da_modifiare = await manager
          .createQueryBuilder()
          .select('proforma.*')
          .from('proforma', 'proforma')
          .where('proforma.tipo_cliente = :tipoCliente', { tipoCliente: 0 })
          .andWhere('proforma.id_cliente = :idCliente', { idCliente: model.dealer })
          .andWhere('proforma.tipo_proforma = :tipoProforma', { tipoProforma: 0 })
          .andWhere('proforma.is_deleted = :isDeleted', { isDeleted: false })
          .andWhere('proforma.data_proforma BETWEEN :start AND :end', {
            start: model.data_inizio_contratto,
            end: model.data_fine_contratto
          })
          .andWhere('(SELECT COUNT(id) FROM fatture WHERE fatture.rif_proforma = proforma.id) = 0')
          .getRawMany();

        for (let da_modificare of proforma_da_modifiare) {
          await this.proformaService.recalcTotaleProforma(da_modificare.id)
          await this.proformaService.genPdfProforma(da_modificare.id)
        }

      } else {
        model.data_inizio_contratto = new Date();
        model.data_fine_contratto = new Date(model.data_inizio_contratto.getFullYear() + 1, model.data_inizio_contratto.getMonth(), model.data_inizio_contratto.getDate());
      }
    })
  }

  async getContrConsumo(
    search: ContrattoSearch = {},
    page: number = 1,
    limit: number = 20,
    sort: string = 'id',
    order: 'DESC' | 'ASC' = 'DESC'
  ): Promise<{ contr: any[], total: number }> {
    page = Math.max(1, Number(page));
    limit = Math.max(1, Math.min(50, Number(limit)));
    const validOrder = ['DESC', 'ASC'].includes(order) ? order : 'DESC';
    const sortColumn = ContrattoSearchKeys.includes(sort) ? sort : 'id';

    const query = this.entityManager.createQueryBuilder()
      .select('oag.*')
      .from('v_contratti_a_Consumo', 'oag')

    this.applyFilters(query, search);

    // Obtener el total de registros
    const totalQueryBuilder = query.clone();
    const totalResult = await totalQueryBuilder.select('COUNT(*)', 'total').getRawOne();
    const total = Number(totalResult?.total) || 0;

    // Aplicar ordenación y paginación
    query
      .orderBy(`oag.${sortColumn}`, validOrder as 'DESC' | 'ASC')
      .offset((page - 1) * limit)
      .limit(limit);

    const contr = await query.getRawMany();

    return { contr, total };
  }


  async findOne(id: number) {
    try {
      const result = await this.dataSource
        .createQueryBuilder()
        .select('oc.*, d.agente')
        .from('ordini__contratti_a_consumo', 'oc')
        .innerJoin('ordini__contratti_a_consumo__quantita', 'ocacq', 'oc.id = ocacq.contratto')
        .innerJoin('dealers', 'd', 'd.id = oc.dealer')
        .where('oc.id = :id', { id: id })
        .getRawOne();

      if (!result) {
        throw new NotFoundException(`Contratto with ID ${id} not found`);
      }

      return result;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new Error(`Failed to fetch contratto: ${error.message}`);
    }

  }

  async prezzoGaranziaConsumo(dealer: string, contratto: string) {
    const query = await this.dataSource
      .createQueryBuilder()
      .select('tg.id, tg.denominazione, tg.prezzo_listino, ocaq.contratto, ocaq.prezzo_unitario, ocaq.id as id_quantita')
      .from('dealers__garanzie_abilitate', 'dga')
      .innerJoin('ordini__contratti_a_consumo__quantita', 'ocaq', 'dga.tipo_garanzia = ocaq.garanzia')
      .innerJoin('tipi_garanzie', 'tg', 'dga.tipo_garanzia = tg.id')
      .where('ocaq.contratto = :contratto', { contratto: contratto })
      .andWhere('dga.dealer = :dealer', { dealer: dealer })

    const one = await query.getRawMany();

    // if (!one) {
    //   throw new NotFoundException(`abbon with ID ${id} not found`)
    // }

    return one

  }

  async update(id: number, updateOrdiniContrConsumoDto: any, userId: string) {
    return await this.dataSource.transaction(async (manager) => {
      const user = await this.validateUser(userId);

      if (user.role !== 'admin') return

      const ordini = await manager.query('SELECT * FROM ordini__contratti_a_consumo WHERE id = ?', [id])
      const model = updateOrdiniContrConsumoDto

      model.data_inserimento = new Date();

      const { agente, quantita, ...filteredModel } = model;
      console.table(filteredModel)
      const is_saved = await manager
        .createQueryBuilder()
        .update('ordini__contratti_a_consumo')
        .set(filteredModel)
        .where("id = :id", { id })
        .execute();

      if (is_saved) {

        const tipi = await manager.query('SELECT dga.tipo_garanzia FROM dealers__garanzie_abilitate dga WHERE dealer = ? AND attivo = 1', [model.dealer])

        const quantita = await manager.query('SELECT * FROM ordini__contratti_a_consumo__quantita WHERE contratto = ?', [id])

        let index = 0;
        for (let garanzia of quantita) {

          const productKey = tipi[index].tipo_garanzia;

          const { prezzo_unitario, id } = model.quantita[`${productKey}`]

          await this.dataSource.query('UPDATE ordini__contratti_a_consumo__quantita SET prezzo_unitario = ? WHERE id = ?', [prezzo_unitario, id])

          index++
        }

        // Ricalcolo proforma non fatturati
        const proforma_da_modifiare = await manager
          .createQueryBuilder()
          .select('proforma.*')
          .from('proforma', 'proforma')
          .where('proforma.tipo_cliente = :tipoCliente', { tipoCliente: 0 })
          .andWhere('proforma.id_cliente = :idCliente', { idCliente: model.dealer })
          .andWhere('proforma.tipo_proforma = :tipoProforma', { tipoProforma: 0 })
          .andWhere('proforma.is_deleted = :isDeleted', { isDeleted: false })
          .andWhere('proforma.data_proforma BETWEEN :start AND :end', {
            start: model.data_inizio_contratto,
            end: model.data_fine_contratto
          })
          .andWhere('(SELECT COUNT(id) FROM fatture WHERE fatture.rif_proforma = proforma.id) = 0')
          .getRawMany();

        for (let da_modificare of proforma_da_modifiare) {
          await this.proformaService.recalcTotaleProforma(da_modificare.id)
          await this.proformaService.genPdfProforma(da_modificare.id)
        }

      } else {
        model.data_inizio_contratto = new Date();
        model.data_fine_contratto = new Date(model.data_inizio_contratto.getFullYear() + 1, model.data_inizio_contratto.getMonth(), model.data_inizio_contratto.getDate());
      }
    })
  }

  async remove(id: number) {
    const result = await this.dataSource
      .createQueryBuilder()
      .update('ordini__contratti_a_consumo')
      .set({ is_deleted: 1 })
      .where("id = :id", { id })
      .execute();

    if (result.affected === 0) {

      throw new NotFoundException(`Officine with ID ${id} not found`)

    }

    return `Delete complete`;
  }

  async getPrezzoGaranzia(dealer: any, dataAttivazione: string, soccorsoKm: number, prezziDefaultSoccorsi: any): Promise<number> {
    const result = await this.entityManager.query(`
      SELECT * FROM ordini__contratti_a_consumo ocac
      WHERE ocac.dealer = ?
      AND ? BETWEEN ocac.data_inizio_contratto AND ocac.data_fine_contratto
      LIMIT 1
    `, [dealer, dataAttivazione]);

    if (result.length > 0) {
      const ordiniContrConsumo = result[0];
      const soccorsoKey = `soccorso_${soccorsoKm}km`;
      const prezzo = ordiniContrConsumo[soccorsoKey] || prezziDefaultSoccorsi[soccorsoKm];
      return prezzo;
    } else {
      return prezziDefaultSoccorsi[soccorsoKm];
    }
  }

  private validateUser(email: string): Promise<User> {

    const user = this.usersService.findByUsername(email)

    if (!user) throw new NotFoundException('Usuario no encontrado');

    return user;
  }

  applyFilters(query: SelectQueryBuilder<any>, search: ContrattoSearch): void {
    // Lista de campos válidos para filtrar (excluyendo page y limit)
    const validFields = Object.keys(search).filter(key => !['page', 'limit', 'sort', 'order'].includes(key));

    validFields.forEach(key => {
      const value = search[key];
      if (value !== undefined && value !== null && value !== '') {

        if (value && key === 'data_inizio_contratto' || key === 'data_fine_contratto') {
          const newValue = JSON.parse(value)
          console.log('newValue: ', newValue)
          const fromDate = newValue.from;
          const toDate = newValue.to;
          query.andWhere(
            `DATE(oag.${key}) BETWEEN :${key}From AND :${key}To`,
            {
              [`${key}From`]: fromDate,
              [`${key}To`]: toDate
            }
          )
        }

        if (key === 'id_dealer') {
          query.andWhere(`oag.${key} =:${key}`, { [key]: `${value}` });
        }

        if (typeof value === 'string' && key !== 'data_inizio_contratto' && key !== 'data_fine_contratto' && key !== 'id_dealer') {
          query.andWhere(`oag.${key} LIKE :${key}`, { [key]: `%${value}%` });
        } else if (typeof value === 'number') {
          query.andWhere(`oag.${key} = :${key}`, { [key]: value });
        }
      }
    });
  }
}
