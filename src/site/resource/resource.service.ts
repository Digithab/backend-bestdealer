import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { CreateResourceDto } from './dto/create-resource.dto';
import { UpdateResourceDto } from './dto/update-resource.dto';
import { DataSource, EntityManager } from 'typeorm';
import { InjectDataSource, InjectEntityManager } from '@nestjs/typeorm';
import { User } from 'src/interfaces/interfaces';
import { UsersService } from 'src/modules/users/users.service';
import { FtpServiceService } from 'src/ftp-service/ftp-service.service';

@Injectable()
export class ResourceService {

  constructor(
    @InjectEntityManager() private entityManager: EntityManager,

    @InjectDataSource() private dataSource: DataSource,

    private usersService: UsersService,

    private ftpServiceService: FtpServiceService
  ) { }

  async getAgenti() {
    try {
      const agenti = await this.dataSource.createQueryBuilder()
        .select('a.id as value, a.sigla as label')
        .from('agenti', 'a')
        .orderBy('a.sigla')
        .getRawMany();

      return agenti
    } catch (error) {
      console.error('Error fetching agenti:', error);
      throw new Error('Failed to fetch agenti');
    }
  }

  async getAgentiDenomizacione() {
    try {
      const agenti = await this.dataSource.createQueryBuilder()
        .select('a.id as value, a.denominazione as label')
        .from('agenti', 'a')
        .orderBy('a.sigla')
        .getRawMany();

      return agenti
    } catch (error) {
      console.error('Error fetching agenti:', error);
      throw new Error('Failed to fetch agenti');
    }
  }

  async getDealer(agente?: string, denominazione?: string, id?: string) {
    try {
      let query = `
            SELECT d.id as value, d.denominazione as label
            FROM dealers d
        `;

      const conditions: string[] = [];
      const params: any[] = [];

      if (agente) {
        conditions.push('d.agente = ?');
        params.push(agente);
      }

      if (denominazione) {
        conditions.push('d.denominazione LIKE ?');
        params.push(`%${denominazione}%`);
      }

      if (id) {
        conditions.push('d.id = ?');
        params.push(id);
      }

      if (conditions.length > 0) {
        query += ' WHERE ' + conditions.join(' AND ');
      }
      query += ' LIMIT 50';
      const dealers = await this.dataSource.query(query, params);
      return dealers;
    } catch (error) {
      console.error('Error fetching dealers:', error);
      throw new Error('Failed to fetch dealers');
    }
  }

  async getClienti() {
    const clienti = await this.dataSource.query(`
      SELECT c.id as value, c.denominazione as label , c.* FROM clienti c
      `
    )

    return clienti
  }


  async findByClienti(search: string, client_type?: any) {
    console.log('client_type___ ', client_type)
    console.log('search___ ', search)
    let query: any
    let params: any[] = [];

    query = `
      SELECT id AS value, denominazione AS label, tipo
      FROM (
          SELECT
              d.id AS id,
              d.denominazione AS denominazione,
              0 AS tipo
          FROM dealers d
          WHERE d.stato = 1
          UNION ALL
          SELECT
              c.id AS id,
              c.denominazione AS denominazione,
              1 AS tipo
          FROM clienti c
          WHERE c.is_deleted = 0
        ) AS combined
    `;

    if (search && search.trim() !== '') {
      const searchTerm = search.trim();

      if (/^\d+$/.test(searchTerm)) {

        query += ' WHERE id = ? OR denominazione LIKE ?';
        params.push(searchTerm, `%${searchTerm}%`);
      } else {

        query += ' WHERE denominazione LIKE ?';
        params.push(`%${searchTerm}%`);
      }

      query += ' LIMIT 50';

    }
    console.log('query__ ', query)
    const items = await this.entityManager.query(
      query, params
    )

    return items;
  }

  async dealersVenditori(dealer: string) {
    const venditore = await this.dataSource.query(`
      SELECT dv.id as value , dv.nome as label FROM dealers__venditori dv
      WHERE dealer = ?  
    `, [dealer]
    )

    return venditore
  }

  async getMarca() {
    const marca = await this.dataSource.query(`
      SELECT vm.id as value, vm.nome as label FROM veicoli__marche vm 
      `)

    return marca
  }

  async getModelo(marca: string) {
    const modello = await this.dataSource.query(`
      SELECT vm.id as value, vm.nome as label, vm.* FROM veicoli__modelli vm 
      WHERE vm.marca = ?  
    `, [marca])

    return modello
  }

  async getFornitori() {
    const fornitori = await this.dataSource.query(`
      SELECT f.id as value, f.denominazione as label FROM fornitori f
      `)

    return fornitori
  }

  // TODO #1 paginar
  async getDealers() {
    const dealers = await this.dataSource.query(`
      SELECT f.id as value, f.denominazione as label FROM dealers f ORDER BY f.id DESC
      `)

    return dealers
  }

  async GaranzieDealer(dealer: any) {
    const garanzie = await this.dataSource.query(`
      select 
      tg.id,
      tg.denominazione 
      from dealers__garanzie_abilitate dg       
      join tipi_garanzie tg ON dg.tipo_garanzia = tg.id 
      where dg.dealer = ?
      and dg.attivo = 1  
    `, [dealer]
    )

    return garanzie
  }

  async typeGaranties(id: any) {

    const [result] = await this.dataSource.query(
      `SELECT id, denominazione, prezzo_listino FROM tipi_garanzie WHERE id = ?`,
      [id]
    );

    return result || null;
  }

  async updatePrezzo(id: string, prezzo: any) {

    const result = await this.dataSource.createQueryBuilder()
      .update('tipi_garanzie')
      .set({ prezzo_listino: prezzo })
      .where('id = :id', { id })
      .execute();

    return result
  }

  async uploadFile(data: any, userId: string) {

    const user = await this.validateUser(userId);

    if (user.role !== 'admin') {
      throw new ForbiddenException('No tienes permisos para crear garantías');
    }

    const { id, file } = data
    const base64String = file.buffer.toString('base64');

    const buffer = Buffer.from(base64String, 'base64');

    console.log('uploading file....')
    const remotePath = `/httpdocs/storage/prova/${id}.pdf`;
    await this.ftpServiceService.uploadFile(buffer, remotePath);
    console.log('File upload 200!!');

  }

  private validateUser(email: string): Promise<User | any> {

    const user = this.usersService.findByUsername(email)

    if (!user) throw new NotFoundException('Usuario no encontrado');

    return user;
  }
}
