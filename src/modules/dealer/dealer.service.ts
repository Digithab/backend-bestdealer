import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { CreateDealerDto } from './dto/create-dealer.dto';
import { UpdateDealerDto } from './dto/update-dealer.dto';
import { InjectDataSource, InjectEntityManager, InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository, SelectQueryBuilder } from 'typeorm';
import { UsersService } from '../users/users.service';
import { User } from 'src/interfaces/interfaces';
import { FtpServiceService } from 'src/ftp-service/ftp-service.service';
import { format } from 'date-fns';
const path = require('path');

export const DealerSearchKeys = [
  'tipo_persona',
  'denominazione',
  'cod_univoco',
  'pec',
  'data_iscrizione',
  'tipi',
  'card_soccorso',
  'soccorso__num_traini',
  'indirizzo',
  'cap',
  'comune',
  'prov',
  'sigla'
]

@Injectable()
export class DealerService {

  constructor(

    @InjectEntityManager() private entityManager: EntityManager,

    @InjectDataSource() private dataSource: DataSource,

    private usersService: UsersService,

    private ftpServiceService: FtpServiceService

  ) { }

  async findDealerDocuments(id: any, userId: any): Promise<any> {

    const user = await this.validateUser(userId)
    if (user.role !== 'admin') {
      throw new ForbiddenException('No tienes permisos para crear dealer');
    }

    const data = await this.dataSource.query(`
      select * from dealers__allegati da WHERE da.dealer = ?  and da.is_deleted = 0;
    `, [id])


    return data
  }

  async findDocument(id: any, userId: any): Promise<any> {
    console.log('id: ', id)
    const user = await this.validateUser(userId)
    if (user.role !== 'admin') {
      throw new ForbiddenException('No tienes permisos para crear dealer');
    }

    const [data] = await this.dataSource.query(`
      select * from dealers__allegati da WHERE da.id = ?  and da.is_deleted = 0;
    `, [id])

    console.log('data: ', data)
    return data
  }

  async uploadDocument(documentDto: any, userId: any) {
    const user = await this.validateUser(userId)
    if (user.role !== 'admin') {
      throw new ForbiddenException('No tienes permisos para crear documento');
    }

    const { file, dealer } = documentDto;
    const fileName = file.originalname;
    const fileNameWithoutExtension = path.basename(fileName, path.extname(fileName));
    const fileExtension = path.extname(fileName).substring(1); // Elimina el punto inicial
    console.log('fileExtension: ', fileExtension)
    const insert = await this.dataSource.query(`
      INSERT INTO dealers__allegati (descrizione, ext, dealer, is_deleted)
      VALUES (?, ?, ?, ?)
    `, [fileNameWithoutExtension, fileExtension, dealer, 0])

    if (file.buffer) {
      console.log('uploading file....');

      const base64String = file.buffer.toString('base64');
      await this.uploadFile(base64String, insert.insertId, fileExtension);
      try {

      } catch (error) {
        console.log('error__', error)
      }
    }

    return { message: 'Documento guardado con éxito' }
  }

  async deleteDocument(id: any, userId: any) {
    console.log('Documento a eliminar: ', id)
    const user = await this.validateUser(userId)
    if (user.role !== 'admin') {
      throw new ForbiddenException('No tienes permisos para crear documento');
    }

    const result = await this.dataSource
      .createQueryBuilder()
      .update('dealers__allegati')
      .set({ is_deleted: 1 })
      .where("id = :id", { id })
      .execute();

    if (result.affected === 0) {
      throw new NotFoundException(`Documento with ID ${id} not found`)
    }

    await this.ftpServiceService.deleteFile(`${id}.pdf`)
    return { message: 'Documento eliminado con éxito' }
  }

  async create(createDealerDto: any, userId: any) {

    const user = await this.validateUser(userId)

    if (user.role !== 'admin') {
      throw new ForbiddenException('No tienes permisos para crear dealer');
    }
    console.log('createDealerDto__ ', createDealerDto)
    const today = format(new Date(), 'yyyy-MM-dd');

    createDealerDto.dealer.data_iscrizione = today;

    const { dealer, garanzie, contatti, amministrazione, officina } = createDealerDto

    console.log('createDealerDto___ ', createDealerDto)

    return await this.dataSource.transaction(async (manager) => {

      const result = await manager
        .createQueryBuilder()
        .insert()
        .into('dealers')
        .values(dealer)
        .execute();

      const dealerId = result.raw?.insertId || result.raw?.[0]?.id || result.generatedMaps?.[0]?.id;

      let garanziaDaSalvare: any

      const garantieArray = this.filterActiveGaranzie(garanzie);
      console.log('*****************************************')

      console.log('garantieArray___ ', garantieArray)

      console.log('*****************************************')

      for (let i = 0; i < garantieArray.length; i++) {
        const element = garantieArray[i];

        if (element.key === 'card_soccorso') {
          await manager.createQueryBuilder()
            .update('dealers')
            .set({
              card_soccorso: 1,
            })
            .where('id = :id', { id: dealerId })
            .execute();
        }

        let idGaranzie: any
        if (element.key !== 'card_soccorso') {
          idGaranzie = await manager
            .createQueryBuilder()
            .select('g.id')
            .from('tipi_garanzie', 'g')
            .where('g.denominazione LIKE :tipoGaranzia', { tipoGaranzia: `%${element.key}%` })
            .getRawOne();
        }

        console.log('idGaranzie:: ', idGaranzie)

        garanziaDaSalvare = await manager
          .createQueryBuilder()
          .select('*')
          .from('dealers__garanzie_abilitate', 'g')
          .where('g.tipo_garanzia = :id', { id: idGaranzie })
          .andWhere('g.dealer = :dealerId', { dealerId })
          .getRawOne();

        console.log('idGaranzie::', typeof idGaranzie)

        if (!garanziaDaSalvare && idGaranzie !== undefined) {
          await manager
            .createQueryBuilder()
            .insert()
            .into('dealers__garanzie_abilitate')
            .values({
              attivo: 1,
              dealer: dealerId,
              coperture_aggiuntive: element.additionalCoverage,
              tipo_garanzia: idGaranzie.id
            })
            .execute();
        }
      }

      // Salvataggio dei contatti del dealer
      if (contatti.nome || contatti.telefono || contatti.cellulare || contatti.email) {
        await manager
          .createQueryBuilder()
          .insert()
          .into('dealers__contatti')
          .values({
            nome: contatti.nome,
            telefono: contatti.telefono,
            cellulare: contatti.cellulare,
            email: contatti.email,
            ruolo: 0,
            dealer: dealerId
          })
          .execute();
      }

      if (amministrazione.nome || amministrazione.telefono || amministrazione.cellulare || amministrazione.email) {
        await manager
          .createQueryBuilder()
          .insert()
          .into('dealers__contatti')
          .values({
            nome: amministrazione.nome,
            telefono: amministrazione.telefono,
            cellulare: amministrazione.cellulare,
            email: amministrazione.email,
            ruolo: 1,
            dealer: dealerId
          })
          .execute();
      }

      if (officina.nome || officina.telefono || officina.cellulare || officina.email) {
        console.log('***** dealers__contatti OFFICINE',)
        await manager
          .createQueryBuilder()
          .insert()
          .into('dealers__contatti')
          .values({
            nome: officina.nome,
            telefono: officina.telefono,
            cellulare: officina.cellulare,
            email: officina.email,
            ruolo: 2,
            dealer: dealerId
          })
          .execute();
      }

      // Salvataggio del venditore di default, chiamato "Azienda"
      const venditore = {

      }
      console.log('***** dealers__venditori',)
      await manager
        .createQueryBuilder()
        .insert()
        .into('dealers__venditori')
        .values({
          dealer: dealerId,
          nome: 'Azienda',
          is_deleted: 0
        })
        .execute();
    })
  }

  async createVenditore(data: any, userId) {
    const user = await this.validateUser(userId)

    if (user.role !== 'admin') {
      throw new ForbiddenException('No tienes permisos para crear el venditore');
    }

    await this.dataSource
      .createQueryBuilder()
      .insert()
      .into('dealers__venditori')
      .values(data)
      .execute();

    return { meesage: 'Guardado con extio' }
  }

  async getDealer(
    search: any = {},
    page: number = 1,
    limit: number = 20,
    sort: string = 'id',
    order: 'ASC' | 'DESC' = 'ASC'
  ): Promise<{ dealer: any[], total: number }> {
    page = Math.max(1, Number(page));
    limit = Math.max(1, Math.min(50, Number(limit)));
    const validOrder = ['ASC', 'DESC'].includes(order) ? order : 'ASC';
    const sortColumn = DealerSearchKeys.includes(sort) ? sort : 'id';

    const query = this.entityManager.createQueryBuilder()
      .select("d.*, co.citta, co.provincia, a.sigla as sigla, GROUP_CONCAT(DISTINCT tg.denominazione ORDER BY tg.denominazione SEPARATOR ', ') as tipi")
      .from('dealers', 'd')
      .innerJoin('comuni', 'co', 'd.comune = co.id')
      .innerJoin('agenti', 'a', 'd.agente = a.id')
      .innerJoin('dealers__garanzie_abilitate', 'dga', 'd.id = dga.dealer')
      .innerJoin('tipi_garanzie', 'tg', 'dga.tipo_garanzia = tg.id')
      .groupBy('d.id, a.sigla, co.citta, co.provincia')
      ;

    this.applyFilters(query, search);

    // Obtener el total de registros
    const totalQueryBuilder = this.entityManager.createQueryBuilder()
      .select("COUNT(DISTINCT d.id)", "total")
      .from('dealers', 'd')
      .innerJoin('comuni', 'co', 'd.comune = co.id')
      .innerJoin('agenti', 'a', 'd.agente = a.id')
      .innerJoin('dealers__garanzie_abilitate', 'dga', 'd.id = dga.dealer')
      .innerJoin('tipi_garanzie', 'tg', 'dga.tipo_garanzia = tg.id')
      .where('dga.attivo = 1');
    const totalResult = await totalQueryBuilder.select('COUNT(*)', 'total').getRawOne()
    const total = Number(totalResult?.total) || 0;

    // Aplicar ordenación y paginación
    query
      .orderBy(`d.${sortColumn}`, validOrder as 'ASC' | 'DESC')
      .offset((page - 1) * limit)
      .limit(limit);

    const dealer = await query.getRawMany();

    return { dealer, total };
  }

  async findOne(id: number) {
    const [dealer] = await this.dataSource.query(`
      SELECT d.*, c.provincia 
      FROM dealers d 
      JOIN comuni c ON d.comune = c.id
      WHERE d.id = ?
    `, [id])

    const tipi = await this.dataSource.query(`
      SELECT
        tg.id,
        COALESCE(dga.id, 0) AS id_abilitate,
        tg.denominazione,
        dga.dealer,
        dga.attivo,
        dga.coperture_aggiuntive
      FROM tipi_garanzie tg
      LEFT JOIN dealers__garanzie_abilitate dga ON tg.id = dga.tipo_garanzia AND dga.dealer = ?
    `, [id])

    const [contact] = await this.dataSource.query(`SELECT * FROM dealers__contatti dc WHERE dc.dealer = ? AND ruolo = 0;`, [id])
    const [adm] = await this.dataSource.query(`SELECT * FROM dealers__contatti dc WHERE dc.dealer = ? AND ruolo = 1;`, [id])
    const [office] = await this.dataSource.query(`SELECT * FROM dealers__contatti dc WHERE dc.dealer = ? AND ruolo = 2;`, [id])

    const [Dealer, Tipo, Contact, Adm, Office] = await Promise.all([
      dealer,
      tipi,
      contact,
      adm,
      office
    ])

    return {
      ...Dealer,
      Tipo: Tipo,
      Contact: Contact,
      Adm: Adm,
      Office: Office
    }
  }

  async findVenditore(dealer: any) {

    if (!dealer) {
      throw new NotFoundException(`Venditore is required`);
    }
    const data = await this.dataSource.query(`
      SELECT * FROM dealers__venditori WHERE dealer = ? AND is_deleted = 0
    `, [dealer])

    return data
  }

  async update(id: number, updateDealerDto: any) {
    try {

      const { dealer, garanzie, amministrazione, contatti, officina } = updateDealerDto

      const result = await this.dataSource
        .createQueryBuilder()
        .update('dealers')
        .set(dealer)
        .where("id = :id", { id })
        .execute();

      console.log('garanzie: ', garanzie)

      // console.log('data: ', data)
      for (let item of garanzie) {

        const { id_abilitate, attivo, coperture_aggiuntive } = item

        console.log('item: ', item)

        const [isExist] = await this.dataSource.query(`
          SELECT EXISTS (
            SELECT 1 
            FROM dealers__garanzie_abilitate
            WHERE id = ?
            AND dealer = ?
          ) AS isExist;
        `, [id_abilitate, dealer.id])

        console.log('isExist: ', isExist.isExist)
        if (isExist.isExist == 0) {
          await this.dataSource
            .createQueryBuilder()
            .insert()
            .into('dealers__garanzie_abilitate')
            .values({
              attivo: 1,
              dealer: dealer.id,
              coperture_aggiuntive: !coperture_aggiuntive ? '' : coperture_aggiuntive,
              tipo_garanzia: item.id
            })
            .execute();
        } else {
          await this.dataSource
            .createQueryBuilder()
            .update('dealers__garanzie_abilitate')
            .set({
              attivo: attivo,
              coperture_aggiuntive: coperture_aggiuntive,
            })
            .where("id = :id", { id: id_abilitate })
            .execute();

        }
      }

      if (contatti.nome || contatti.telefono || contatti.cellulare || contatti.email) {
        await this.dataSource.query(`
          CALL actualizar_o_insertar_contatto(?, ?, ?, ?, ?, ?);
          `, [id, 0, contatti.nome, contatti.telefono, contatti.cellulare, contatti.email])
      }

      if (amministrazione.nome || amministrazione.telefono || amministrazione.cellulare || amministrazione.email) {
        await this.dataSource.query(`
          CALL actualizar_o_insertar_contatto(?, ?, ?, ?, ?, ?);
          `, [id, 1, amministrazione.nome, amministrazione.telefono, amministrazione.cellulare, amministrazione.email])
      }

      if (officina.nome || officina.telefono || officina.cellulare || officina.email) {
        console.log('***** dealers__contatti OFFICINE',)
        await this.dataSource.query(`
          CALL actualizar_o_insertar_contatto(?, ?, ?, ?, ?, ?);
          `, [id, 2, officina.nome, officina.telefono, officina.cellulare, officina.email])
      }


      if (result.affected === 0) {

        throw new NotFoundException(`Cliente with ID ${id} not found`);

      }

      return { message: `Cliente with ID ${id} has been updated successfully` };

    } catch (error) {

      console.error('Error al actualizar el clienti::: ', error)

      if (error instanceof NotFoundException) {

        throw error

      }

      throw new Error('No se pudo actualizar el clienti');

    }
  }

  async updateVenditore(id: number, data: any) {
    try {
      const result = await this.dataSource
        .createQueryBuilder()
        .update('dealers__venditori')
        .set(data)
        .where("id = :id", { id })
        .execute();

      if (result.affected === 0) {
        throw new NotFoundException(`Venditore with ID ${id} not found`)
      }

      return { message: 'Venditore has been updated successfuully' }
    } catch (error) {
      console.error('Error al actualizar el venditore::: ', error)

      if (error instanceof NotFoundException) {

        throw error

      }

      throw new Error('No se pudo actualizar el clienti');
    }
  }

  async remove(id: number) {

    const result = await this.dataSource
      .createQueryBuilder()
      .update('dealers')
      .set({ stato: 1 })
      .where("id = :id", { id })
      .execute();

    if (result.affected === 0) {

      throw new NotFoundException(`Officine with ID ${id} not found`)

    }

    return `Delete complete`;

  }

  async removeVenditore(id: number) {

    const result = await this.dataSource
      .createQueryBuilder()
      .update('dealers__venditori')
      .set({ is_deleted: 1 })
      .where("id = :id", { id })
      .execute();

    if (result.affected === 0) {

      throw new NotFoundException(`Venditore with ID ${id} not found`)

    }

    return `Delete complete`;

  }

  type(value: string) {
    switch (value) {
      case 'Fisica':
        return '0'
        break;
      case 'Giuridica':
        return '1'
        break;
      default:
      // code block
    }
  }

  applyFilters(query: SelectQueryBuilder<any>, search: any): void {
    // Lista de campos válidos para filtrar (excluyendo page y limit)
    const validFields = Object.keys(search).filter(key => !['page', 'limit', 'sort', 'order'].includes(key));

    validFields.forEach(key => {
      const value = search[key];
      console.log('value: ', value)
      if (value !== undefined && value !== null && value !== '') {

        if (key === 'sigla') {
          query.andWhere(`a.${key} = :${key}`, { [key]: value });
        }

        if (key === 'tipo_persona' && value !== undefined) {
          query.andWhere(`d.tipo_persona = :${key}`, { [key]: this.type(value) });
        }

        if (typeof value === 'string' && key !== 'sigla' && key !== 'tipo_persona') {
          query.andWhere(`d.${key} LIKE :${key}`, { [key]: `%${value}%` });
        } else if (typeof value === 'number') {
          query.andWhere(`d.${key} = :${key}`, { [key]: value });
        }
      }
    });
  }

  private validateUser(email: string): Promise<User> {

    const user = this.usersService.findByUsername(email)

    if (!user) throw new NotFoundException('Usuario no encontrado');

    return user;
  }

  filterActiveGaranzie(garanzie) {
    const result = [];

    for (const [key, value] of Object.entries(garanzie)) {
      if ((key.startsWith('best_') || key.startsWith('gest_') || key === 'ddc' || key === 'card_soccorso') && value === true) {
        const coperturePath = `coperture_aggiuntive_${key}`;

        result.push({
          key,
          value,
          additionalCoverage: garanzie[coperturePath] || ''
        });
      }
    }
    console.log('result: ', result)
    return result;
  }

  async uploadFile(base64String: string, fileName: string, ext: string) {
    // Convertir base64 a buffer
    const buffer = Buffer.from(base64String, 'base64');
    console.log('uploading file....')
    const remotePath = `/httpdocs/storage/prova/${fileName}.${ext}`;
    try {
      await this.ftpServiceService.uploadFile(buffer, remotePath);
      console.log('File upload 200!!');

    } catch (error) {
      console.log('error__', error)
    }
  }
}
