import { forwardRef, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { CreateAbbonamentiDto } from './dto/create-abbonamenti.dto';
import { UpdateAbbonamentiDto } from './dto/update-abbonamenti.dto';
import { DataSource, EntityManager, SelectQueryBuilder } from 'typeorm';
import { InjectDataSource, InjectEntityManager } from '@nestjs/typeorm';
import { AbonamentiSearch } from './interface/abbonamenti.interface';
import { Dealer, User } from 'src/interfaces/interfaces';
import { UsersService } from 'src/modules/users/users.service';
import { addMonths, format, lastDayOfMonth, parseISO } from 'date-fns';
import { ProformaService } from '../../Fatture/proforma/proforma.service';

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
    private proformaService: ProformaService

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
  async create(createAbbonamentiDto: any, userId: string) {
    return await this.dataSource.transaction(async (manager) => {
      const user = await this.validateUser(userId);

      const abbonamnenti = createAbbonamentiDto
      abbonamnenti.data_inserimento = new Date();
      abbonamnenti.data_inizio_abbonamento = new Date();

      const save = await manager
        .createQueryBuilder()
        .insert()
        .into('ordini__abbonamenti_garanzie')
        .values(
          abbonamnenti
        )
        .execute();
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
          abbonamento__id: save.raw?.insertId,
          is_deleted: false,
        }
        const saveProforma = await manager
          .createQueryBuilder()
          .insert()
          .into('proforma')
          .values(
            proforma
          )
          .execute();
        await manager.query('COMMIT');

        console.log('saveProforma.raw?.insertId___ ', saveProforma.raw?.insertId)
        await this.proformaService.recalcTotaleProforma(saveProforma.raw?.insertId)
      }
      await manager.query('COMMIT');

    })
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
      .select('oag.*, a.sigla, d.denominazione')
      .from('ordini__abbonamenti_garanzie', 'oag')
      .innerJoin('agenti', 'a', 'oag.agente = a.id')
      .innerJoin('dealers', 'd', 'oag.dealer = d.id');

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

  async update(id: number, updateAbbonamentiDto: any, userId: string) {
    return await this.dataSource.transaction(async (manager) => {
      const user = await this.validateUser(userId);

      if (user.role !== 'admin') return

      const abbonamenti = await this.findOne(id);
      console.log('abbonamenti___ ', abbonamenti)
      const all_proforma = await manager.query('SELECT * FROM proforma WHERE tipo_proforma = 4 AND abbonamento__id', [abbonamenti.id])
      console.log('all_proforma___ ', all_proforma)
      let has_fatture = false;

      for (let proforma of all_proforma) {
        console.log('PRRR__', await manager.query('SELECT * FROM proforma WHERE tipo_proforma = 4 AND abbonamento__id = ?', [proforma.id]))
        has_fatture = has_fatture || await manager.query('SELECT * FROM proforma WHERE tipo_proforma = 4 AND abbonamento__id = ?', [proforma.id])

      }

      if (has_fatture) throw new NotFoundException('Non è possibile modificare un abbonamento su cui è già stata emessa fattura');
      Object.assign(abbonamenti, updateAbbonamentiDto);
      await this.entityManager
        .createQueryBuilder()
        .update('ordini__abbonamenti_garanzie')
        .set(abbonamenti)
        .where('id = :id', { id })
        .execute();
      //calculateProformaDate
      for (let proforma of all_proforma) {
        has_fatture = await manager.query('SELECT * FROM proforma WHERE tipo_proforma = 4 AND abbonamento__id = ?', [proforma.id])
        proforma.data_proforma = this.calculateProformaDate(abbonamenti.data_inizio_abbonamento, proforma.abbonamento__mese, abbonamenti.pagamento__data)
        proforma.pagamento__rate = abbonamenti.pagamento__rate;
        proforma.pagamento__differita = abbonamenti.pagamento__differita;
        proforma.pagamento__periodo = abbonamenti.pagamento__periodo;
        const id_proforma = proforma.id
        await this.entityManager
          .createQueryBuilder()
          .update('proforma')
          .set(proforma)
          .where('id = :id', { id_proforma })
          .execute();

        await this.proformaService.recalcTotaleProforma(id_proforma)
        //Generar PDF
      }
    })

  }

  async remove(id: number) {

    const result = await this.dataSource
      .createQueryBuilder()
      .update('ordini__abbonamenti_garanzie')
      .set({ stato: 1 })
      .where("id = :id", { id })
      .execute();

    if (result.affected === 0) {

      throw new NotFoundException(`Officine with ID ${id} not found`)

    }

    return `Delete complete`;

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

  private validateUser(email: string): Promise<User> {

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
