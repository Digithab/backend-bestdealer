import { ForbiddenException, forwardRef, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { CreateAbbonamentiDto } from './dto/create-abbonamenti.dto';
import { UpdateAbbonamentiDto } from './dto/update-abbonamenti.dto';
import { DataSource, EntityManager, SelectQueryBuilder } from 'typeorm';
import { InjectDataSource, InjectEntityManager } from '@nestjs/typeorm';
import { AbonamentiSearch } from './interface/abbonamenti.interface';
import { Dealer, User } from 'src/interfaces/interfaces';
import { UsersService } from 'src/modules/users/users.service';
import { addMonths, format, lastDayOfMonth, parseISO } from 'date-fns';
import { ProformaService } from '../../Fatture/proforma/proforma.service';
import { WrapperType } from 'src/generate-metadata';

export const AbbonamentiSearchKeys = [
  'id',
  'agente',
  'dealer',
  'data_inizio_abbonamento',
  'ddc_qta',
  'ddc_prz',
  'gest_qta',
  'gest_prz',
  'commento',
  'pagamento__rate',
  'pagamento__differita',
  'pagamento__periodo',
  'pagamento__data'
]

@Injectable()
export class AbbonamentiService {

  constructor(

    @InjectEntityManager() private entityManager: EntityManager,

    @InjectDataSource() private dataSource: DataSource,

    private usersService: UsersService,

    @Inject(forwardRef(() => ProformaService))
    private proformaService: WrapperType<ProformaService>

  ) { }

  getFormattedDate(data_inizio_abbonamento, pagamento__data, i) {
    // Validate inputs
    if (!data_inizio_abbonamento) {
      throw new Error('data_inizio_abbonamento is required');
    }

    // Ensure the date is a valid ISO string
    const startDate = typeof data_inizio_abbonamento === 'string'
      ? data_inizio_abbonamento
      : data_inizio_abbonamento.toISOString();

    return format(
      pagamento__data
        ? addMonths(parseISO(startDate), i)
        : lastDayOfMonth(addMonths(parseISO(startDate), i)),
      'yyyy-MM-dd'
    );
  }
  async create(createAbbonamentiDto: any) {

    // Preparar datos del abonamiento
    const abbonamnenti = {
      ...createAbbonamentiDto,
      data_inserimento: new Date(),
      data_inizio_abbonamento: new Date()
    };

    console.log('createAbbonamentiDto___ ', createAbbonamentiDto)

    let newAbbonamentiId: number;
    let proformaIds: number[] = [];

    // Ejecutar transacción
    await this.dataSource.transaction(async (manager) => {
      // Insertar abonamiento
      const saveResult = await manager
        .createQueryBuilder()
        .insert()
        .into('ordini__abbonamenti_garanzie')
        .values(abbonamnenti)
        .execute();

      newAbbonamentiId = saveResult.raw?.insertId;

      // Preparar todas las proformas en un array
      for (let i = 0; i <= 12; i++) {
        const proforma = {
          tipo_cliente: 0,
          id_cliente: abbonamnenti.dealer,
          agente: abbonamnenti.agente,
          tipo_proforma: 4,
          importo: 0,
          data_inserimento: new Date(),
          data_proforma: this.getFormattedDate(abbonamnenti.data_inizio_abbonamento, abbonamnenti.pagamento__data, i),
          data_invio: '1900-01-01',
          date_invii_successivi: '',
          pagamento__rate: abbonamnenti.pagamento__rate,
          pagamento__differita: abbonamnenti.pagamento__differita,
          pagamento__periodo: abbonamnenti.pagamento__periodo,
          abbonamento__mese: i,
          abbonamento__id: newAbbonamentiId,
          is_deleted: false,
        };

        const result = await manager
          .createQueryBuilder()
          .insert()
          .into('proforma')
          .values(proforma)
          .execute();

        if (result.raw?.insertId) {
          proformaIds.push(result.raw.insertId);
        }
      }
    });

    // Recalcular totales en paralelo
    await Promise.all(
      proformaIds.map(id => {
        this.proformaService.recalcTotaleProforma(id)
        this.proformaService.genPdfProforma(id)
      })
    );

    return { success: true, abbonamentiId: newAbbonamentiId, proformaIds };
  }

  async getAbonamenti(
    search: AbonamentiSearch = {},
    page: number = 1,
    limit: number = 20,
    sort: string = 'id',
    order: 'DESC' | 'ASC' = 'DESC'
  ): Promise<{ abbon: any[], total: number }> {

    page = Math.max(1, Number(page));

    limit = Math.max(1, Math.min(50, Number(limit)));

    const validOrder = ['DESC', 'ASC'].includes(order) ? order : 'DESC';

    const sortColumn = AbbonamentiSearchKeys.includes(sort) ? sort : 'id';

    const query = this.entityManager.createQueryBuilder()
      .select('oag.*')
      .from('vw_abbonamenti', 'oag')

    this.applyFilters(query, search);

    const totalQueryBuilder = query.clone();

    const totalResult = await totalQueryBuilder.select('COUNT(*)', 'total').getRawOne();

    const total = Number(totalResult?.total) || 0;

    query
      .orderBy(`oag.${sortColumn}`, validOrder as 'DESC' | 'ASC')
      .offset((page - 1) * limit)
      .limit(limit);

    const abbon = await query.getRawMany();

    return { abbon, total };
  }


  async findOne(id: number) {
    const query = this.entityManager.createQueryBuilder()
      .select('oag.*')
      .from('ordini__abbonamenti_garanzie', 'oag')
      .where('oag.is_deleted = 0')
      .andWhere('oag.id = :id', { id })

    const abbon = await query.getRawOne();

    if (!abbon) {
      throw new NotFoundException(`abbon with ID ${id} not found`)
    }

    return abbon
  }

  async update(id: number, updateAbbonamentiDto: any) {

    return await this.dataSource.transaction(async (manager) => {
      // Obtener el abonamiento a actualizar
      const abbonamenti = await this.findOne(id);

      // Obtener todas las proformas relacionadas con una sola consulta correcta
      const all_proforma = await manager.query(
        'SELECT * FROM proforma WHERE tipo_proforma = 4 AND abbonamento__id = ?',
        [abbonamenti.id]
      );

      // Verificar si hay facturas asociadas con una sola consulta
      const facturas = await manager.query(
        'SELECT COUNT(*) as count FROM fatture WHERE rif_proforma IN (SELECT id FROM proforma WHERE tipo_proforma = 4 AND abbonamento__id = ?)',
        [abbonamenti.id]
      );

      if (facturas[0]?.count > 0) {
        throw new NotFoundException('Non è possibile modificare un abbonamento su cui è già stata emessa fattura');
      }

      // Actualizar el abonamiento
      const newAbb = Object.assign(abbonamenti, updateAbbonamentiDto);

      await manager
        .createQueryBuilder()
        .update('ordini__abbonamenti_garanzie')
        .set(newAbb)
        .where('id = :id', { id })
        .execute();

      manager.query('COMMIT;');


      // Preparar actualizaciones de proformas
      const proformaUpdates = all_proforma.map(async (proforma) => {
        const updatedProforma = {
          ...proforma,
          data_proforma: this.calculateProformaDate(
            newAbb.data_inizio_abbonamento,
            proforma.abbonamento__mese,
            newAbb.pagamento__data
          ),
          pagamento__rate: newAbb.pagamento__rate,
          pagamento__differita: newAbb.pagamento__differita,
          pagamento__periodo: newAbb.pagamento__periodo
        };

        const id_proforma = proforma.id;

        await manager
          .createQueryBuilder()
          .update('proforma')
          .set(updatedProforma)
          .where('id = :id', { id: id_proforma })
          .execute();

        return id_proforma;
      });

      // Ejecutar todas las actualizaciones en paralelo
      const updatedProformaIds = await Promise.all(proformaUpdates);

      // Recalcular totales en paralelo
      await Promise.all(
        updatedProformaIds.map(proformaId =>
          this.proformaService.recalcTotaleProforma(proformaId)
        )
      );

      return { success: true, abbonamentiId: id, updatedProformas: updatedProformaIds };
    });
  }

  async remove(id: number) {

    const result = await this.dataSource
      .createQueryBuilder()
      .update('ordini__abbonamenti_garanzie')
      .set({ is_deleted: 1 })
      .where("id = :id", { id })
      .execute();

    if (result.affected === 0) {

      throw new NotFoundException(`Officine with ID ${id} not found`)

    }

    return {
      message: 'Delete complete'
    };

  }

  applyFilters(query: SelectQueryBuilder<any>, search: AbonamentiSearch): void {
    // Lista de campos válidos para filtrar (excluyendo page y limit)
    const validFields = Object.keys(search).filter(key => !['page', 'limit', 'sort', 'order'].includes(key));

    validFields.forEach(key => {
      const value = search[key];
      if (value !== undefined && value !== null && value !== '') {

        if (key === 'agente') {
          query.andWhere(`a.sigla = :${key}`, { [key]: value });
        }

        if (typeof value === 'string' && key !== 'agente') {
          query.andWhere(`oag.${key} LIKE :${key}`, { [key]: `%${value}%` });
        } else if (typeof value === 'number') {
          query.andWhere(`oag.${key} = :${key}`, { [key]: value });
        }
      }
    });
  }

  private validateUser(email: string): Promise<User | any> {

    const user = this.usersService.findByUsername(email)

    if (!user) throw new NotFoundException('Usuario no encontrado');

    return user;
  }

  calculateProformaDate(
    startDate: Date,
    monthsToAdd: number,
    hasPagamentoData: boolean
  ): string {
    // Agregar los meses especificados
    const calculatedDate = addMonths(startDate, monthsToAdd);

    // Si tiene pagamento__data, formatear como día específico
    // Si no tiene pagamento__data, formatear como último día del mes
    return hasPagamentoData
      ? format(calculatedDate, 'yyyy-MM-dd')  // equivalente a 'Y-m-d'
      : format(lastDayOfMonth(calculatedDate), 'yyyy-MM-dd');  // equivalente a 'Y-m-t'
  }

}
