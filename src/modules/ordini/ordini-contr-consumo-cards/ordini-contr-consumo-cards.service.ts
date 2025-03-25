import { BadRequestException, forwardRef, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { CreateOrdiniContrConsumoCardDto } from './dto/create-ordini-contr-consumo-card.dto';
import { UpdateOrdiniContrConsumoCardDto } from './dto/update-ordini-contr-consumo-card.dto';
import { InjectDataSource, InjectEntityManager } from '@nestjs/typeorm';
import { DataSource, EntityManager, SelectQueryBuilder } from 'typeorm';
import { User } from 'src/interfaces/interfaces';
import { OrdiniCardSearch } from './interface/ordini_pachetti_cards.interface';
import { UsersService } from 'src/modules/users/users.service';
import { ProformaService } from 'src/modules/Fatture/proforma/proforma.service';
import { MailService } from 'src/mail/mail.service';
import { GenPdfService } from 'src/modules/gen-pdf/gen-pdf.service';
import { format } from 'date-fns';


export const OrdiniSearchCardKeys = [
  'id',
  'denominazione',
  'data_inserimento',
  'data_attivazione',
  'data_scadenza'
]

@Injectable()
export class OrdiniContrConsumoCardsService {

  constructor(

    @InjectEntityManager() private entityManager: EntityManager,

    @InjectDataSource() private dataSource: DataSource,

    private readonly usersService: UsersService,

    @Inject(forwardRef(() => MailService))
    private mailService: MailService,

    @Inject(forwardRef(() => GenPdfService))
    private genPdfService: GenPdfService,

    @Inject(forwardRef(() => ProformaService))
    private proformaService: ProformaService,

  ) { }

  async getPrezzoSoccorso(dealer: any, tipoSoccorso: any, data: any): Promise<number> {
    const prezziDefault = {
      '40': 28,
      '60': 33,
      '100': 39,
      'C': 180,
      'RR': 28,
      'RN': 38
    };

    let selectColumn: string;
    switch (tipoSoccorso) {
      case '40':
      case '60':
      case '100':
        selectColumn = `soccorso_${tipoSoccorso}km`;
        break;
      case 'C':
        selectColumn = 'soccorso_camper';
        break;
      case 'RN':
        selectColumn = 'rest_nazionale';
        break;
      case 'RR':
        selectColumn = 'rest_regionale';
        break;
      default:
        throw new BadRequestException('Invalid soccorso type');
    }

    const queryResult = await this.entityManager
      .createQueryBuilder()
      .select(`ocacc.${selectColumn}`, 'prz')
      .from('ordini__contratti_a_consumo_cardss', 'ocacc')
      .where('ocacc.dealer = :dealer', { dealer })
      .andWhere('ocacc.is_deleted = :is_deleted', { is_deleted: false })
      .andWhere(':data BETWEEN ocacc.data_inizio_contratto AND ocacc.data_fine_contratto', { data })
      .getRawOne();

    console.log('queryResult?.prz ?? prezziDefault[tipoSoccorso]___ ', queryResult?.prz ?? prezziDefault[tipoSoccorso])
    return queryResult?.prz ?? prezziDefault[tipoSoccorso];
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
      console.log('tipoGaranzia?.prezzo_listino__ ', tipoGaranzia?.prz)
      return Number(tipoGaranzia?.prz);
    } else {
      return Number(queryResult.prz)
    }
  }

  async create(createOrdiniContrConsumoCardDto: any, userId: any) {
    const user = await this.validateUser(userId);

    if (user.role !== 'admin') return

    const model = createOrdiniContrConsumoCardDto;
    model.data_inserimento = format(new Date(), 'yyyy-MM-dd')
    model.data_inizio_contratto = format(model.data_inizio_contratto, 'yyyy-MM-dd')
    model.data_fine_contratto = format(model.data_fine_contratto, 'yyyy-MM-dd')

    return await this.dataSource.transaction(async (manager) => {
      await manager
        .createQueryBuilder()
        .insert()
        .into('ordini__contratti_a_consumo_cardss')
        .values(
          model
        )
        .execute();
    })
  }

  async getOrdini(
    search: OrdiniCardSearch = {},
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
    const sortColumn = OrdiniSearchCardKeys.includes(sort) ? sort : 'id';

    const query = this.entityManager.createQueryBuilder()
      .select('op.*, d.denominazione')
      .from('ordini__contratti_a_consumo_cardss', 'op')
      .innerJoin('dealers', 'd', 'op.dealer = d.id')
      .where('op.is_deleted = 0');
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

    return { ordini, total };
  }

  async findOne(id: number) {
    const query = this.entityManager.createQueryBuilder()
      .select('op.*, d.agente as agente')
      .from('ordini__contratti_a_consumo_cardss', 'op')
      .innerJoin('dealers', 'd', 'op.dealer = d.id')
      .where('op.id = :id', { id: id });

    const ordini = await query.getRawMany();
    console.log('ordini___: ', ordini)
    return ordini
  }

  async update(id: number, updateOrdiniContrConsumoCardDto: any, userId: any) {
    return await this.dataSource.transaction(async (manager) => {
      const user = await this.validateUser(userId);

      if (user.role !== 'admin') return

      const model = updateOrdiniContrConsumoCardDto;
      console.log('model::::___', model)
      console.log('ID::::___', id)
      const is_update = await manager
        .createQueryBuilder()
        .update('ordini__contratti_a_consumo_cardss')
        .set(model)
        .where("id = :id", { id })
        .execute();

      console.log('is_update___ ', is_update)
      if (is_update) {
        const proformaDaModificare = await
          manager.query(
            `select pf.* from proforma pf
              where pf.tipo_cliente = 0
              and pf.id_cliente = 2
              and pf.tipo_proforma = 2
              and pf.is_deleted = false
              and(SELECT COUNT(id) FROM fatture WHERE fatture.rif_proforma = pf.id) = 0`,
            [model.dealer])
        console.log('proformaDaModificare___ ', proformaDaModificare)
        for (let proforma of proformaDaModificare) {
          await this.proformaService.recalcTotaleProforma(proforma.id)
        }
      }
    })
  }

  remove(id: number) {
    return `This action removes a #${id} ordiniContrConsumoCard`;
  }

  applyFilters(query: SelectQueryBuilder<any>, search: OrdiniCardSearch): void {
    // Lista de campos válidos para filtrar (excluyendo page y limit)
    const validFields = Object.keys(search).filter(key => !['page', 'limit', 'sort', 'order'].includes(key));

    validFields.forEach(key => {
      const value = search[key];
      if (value !== undefined && value !== null && value !== '') {

        if (value && key === 'data_inizio_contratto') {
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

        if (typeof value === 'string' && key !== 'data_inizio_contratto') {
          query.andWhere(`op.${key} LIKE :${key}`, { [key]: `%${value}%` });
        } else if (typeof value === 'number') {
          query.andWhere(`op.${key} = :${key}`, { [key]: value });
        }
      }
    });
  }

  private validateUser(email: string): Promise<User> {

    const user = this.usersService.findByUsername(email)

    if (!user) throw new NotFoundException('Usuario no encontrado');

    return user;
  }
}
