import { ForbiddenException, Injectable, NotFoundException, Search } from '@nestjs/common';
import { CreateGuastiDto } from './dto/create-guasti.dto';
import { CreateRicambiDto } from './dto/create-ricambi.dto';
import { Guasti } from './entities/guasti.entity';
import { InjectDataSource, InjectEntityManager } from '@nestjs/typeorm';
import { DataSource, EntityManager, SelectQueryBuilder } from 'typeorm';
import { UsersService } from 'src/modules/users/users.service';
import { User } from 'src/interfaces/interfaces';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateGuastiDto } from './dto/update-guasti.dto';
import { FtpServiceService } from 'src/ftp-service/ftp-service.service';
import { format } from 'date-fns';

export const GuastiSearchKeys = [
  'id',
  'dealer',
  'sigla',
  'garanzia',
  'tipo_garanzie',
  'targa',
  'data_guasto',
  'preventivo_riparazione',
  'costo_azienda',
  'costo_dealer',
  'descrizione'
]

@Injectable()
export class GuastiService {
  constructor(
    @InjectEntityManager() private entityManager: EntityManager,

    @InjectDataSource() private dataSource: DataSource,
    private usersService: UsersService,

    private ftpServiceService: FtpServiceService
  ) { }
  async create(createGuastiDto: CreateGuastiDto) {
    const guastiData = typeof createGuastiDto.guasti === 'string'
      ? JSON.parse(createGuastiDto.guasti)
      : createGuastiDto.guasti;

    console.log(guastiData)
    const { garanzie, stato, data_guasto, descrizione, preventivo_riparazione, costo_riparazione, costo_dealer } = guastiData
    const data = format(data_guasto, 'yyyy-MM-dd')
    console.log('data: ', data)
    return await this.dataSource.transaction(async (manager) => {

      const insertedPropietario = await manager.query(
        `INSERT INTO guasti
        (garanzia, stato,data_inserimento ,data_guasto, descrizione,preventivo_riparazione, costo_riparazione, costo_dealer, is_deleted)
        VALUES (?, ?, ?, ?, ?,?,?,?,?)`,
        [
          garanzie,
          stato,
          data,
          data,
          descrizione,
          preventivo_riparazione === null ? 0 : preventivo_riparazione,
          costo_riparazione === null ? 0 : costo_riparazione,
          costo_dealer === null ? 0 : costo_dealer,
          false
        ]
      );

      createGuastiDto.guasto = insertedPropietario.insertId

      if (createGuastiDto.data != '' && createGuastiDto.note != '' && createGuastiDto.estensione_file != '') {
        await this.addEvent(createGuastiDto)
      }

      return { message: "Guasto guardado" }
    })
  }

  async addRicambio(createRicambiDto: CreateRicambiDto) {

    const { fornitore, descrizione, data_acquisto, prezzo_acquisto, prezzo_vendita, guasto } = createRicambiDto;
    console.log('createRicambiDto: ', createRicambiDto)
    // Usar directamente el objeto desestructurado para evitar repetir valores
    const values = [fornitore, descrizione, data_acquisto, prezzo_acquisto, prezzo_vendita, guasto, false];

    try {
      await this.dataSource.query(
        `INSERT INTO ricambi
      (fornitore, descrizione, data_acquisto, prezzo_acquisto, prezzo_vendita, guasto, is_deleted)
      VALUES (?, ?, ?, ?, ?, ?, ?)`,
        values
      );

      return { message: "Ricambi guardado" };
    } catch (error) {
      // Manejar errores específicamente
      throw new Error(`Error al guardar ricambi: ${error.message}`);
    }
  }

  async addEvent(createEventDto: CreateEventDto) {

    const { file, ...newDto } = createEventDto

    const { data, note, guasto, estensione_file } = newDto

    const noteValid = !note ? file.originalname : note

    const estensione = estensione_file === null || estensione_file === undefined ? "" : estensione_file[0]

    console.log('estensione_file___ ', estensione)
    const insertedRicambi = await this.dataSource.transaction(async (manager) => {
      return await manager.query(
        `
      INSERT INTO guasti__eventi
      (data, descrizione, guasto, estensione_file, is_deleted)
      VALUES (?, ?, ?, ?, ?)`,
        [format(data, "yyyy-MM-dd"), noteValid, guasto, estensione, false]
      );
    });


    if (file?.buffer) {
      console.log('uploading file....');

      // Convert Buffer to base64
      const base64String = file.buffer.toString('base64');
      console.log('id guasto: ', insertedRicambi.insertId)
      console.log('estensione_file: ', estensione_file)
      const ext = estensione_file[0]
      await this.uploadFile(base64String, insertedRicambi.insertId, ext);
      console.log('File upload 200!!');
    }


    console.log('insertedPropietario__ ', insertedRicambi)

    return { message: "Event guardado" }

  }

  async uploadFile(base64String: string, fileName: string, estensione_file: string) {
    // Convertir base64 a buffer
    const buffer = Buffer.from(base64String, 'base64');
    console.log('uploading file....')
    const remotePath = `/httpdocs/storage/prova/${fileName}.${estensione_file}`;
    try {
      await this.ftpServiceService.uploadFile(buffer, remotePath);
      console.log('File upload 200!!');

    } catch (error) {
      console.log('error__', error)
    }
  }

  async deleteRicambio(id: number) {
    try {
      const guasti = await this.dataSource.query(
        `UPDATE ricambi SET is_deleted = 1 WHERE id = ?`, [id]
      );
      return guasti[0]
    } catch (error) {
      console.log(error)
    }
  }

  async deleteEvent(id: number) {
    try {
      const event = await this.dataSource.query(
        `UPDATE guasti__eventi SET is_deleted = 1 WHERE id = ?`, [id]
      );

      await this.ftpServiceService.deleteFile(`${id}.pdf`)

      return event[0]
    } catch (error) {
      console.log(error)
    }
  }

  async getAllGuasti(
    search: any = {},
    page: number = 1,
    limit: number = 20,
    sort: string = 'id',
    order: 'DESC' | 'ASC' = 'DESC'
  ): Promise<{ guasti: any[], total: number, total_preventivo_riparazione: number, total_costo_azienda: number, total_costo_dealer: number }> {
    page = Math.max(1, Number(page));
    limit = Math.max(1, Math.min(50, Number(limit)));
    const validOrder = ['ASC', 'DESC'].includes(order) ? order : 'DESC'

    //TODO: sortColumn
    const sortColumn = GuastiSearchKeys.includes(sort) ? sort : 'id'

    const query = this.entityManager.createQueryBuilder()
      .select('g.*')
      .from('v_guasti', 'g')

    this.applyFilters(query, search)

    const totalQueryBuilder = query.clone()
    const totalResult = await totalQueryBuilder.select('COUNT(*)', 'total').getRawOne()
    const importoResult = await totalQueryBuilder.select('SUM(g.preventivo_riparazione) as total_preventivo_riparazione, SUM(g.costo_azienda) as total_costo_azienda, SUM(g.costo_dealer) as total_costo_dealer').getRawOne();
    const total_preventivo_riparazione = Number(importoResult?.total_preventivo_riparazione || 0);
    const total_costo_azienda = Number(importoResult?.total_costo_azienda || 0)
    const total_costo_dealer = Number(importoResult?.total_costo_dealer || 0)
    const total = Number(totalResult?.total) || 0

    query
      .orderBy(`g.${sortColumn}`, validOrder as 'DESC' | 'ASC')
      .offset((page - 1) * limit)
      .limit(limit)

    const guasti = await query.getRawMany()

    return { guasti, total, total_preventivo_riparazione, total_costo_azienda, total_costo_dealer }
  }

  async getTotals() {
    try {
      const guasti = await this.dataSource.query(
        `SELECT * FROM view_totali_guasti`
      );
      return guasti[0]
    } catch (error) {
      console.log(error)
    }
  }

  findAll() {
    return `This action returns all guasti`;
  }

  async findOne(id: number) {
    try {
      const data = await this.dataSource.query(
        `SELECT * FROM guasti g        
        WHERE g.id = ? AND g.is_deleted = 0`, [id]
      );

      return data[0]
    } catch (error) {
      console.log(error)
    }
  }

  async getEvent(id: number) {
    try {

      const event = await this.dataSource.query(
        `SELECT * FROM guasti__eventi ge        
        WHERE ge.guasto = ? AND ge.is_deleted = 0`, [id]
      );
      return event
    } catch (error) {
      console.log(error)
    }
  }

  async getOneEvent(id: number) {
    try {
      console.log('id___ ', id)
      const [event] = await this.dataSource.query(
        `SELECT * FROM guasti__eventi ge        
        WHERE ge.id = ? AND ge.is_deleted = 0`, [id]
      );
      return event
    } catch (error) {
      console.log(error)
    }
  }

  async getRicambi(id: number) {
    try {
      const ricambi = await this.dataSource.query(
        `SELECT r.*,f.denominazione FROM ricambi r
        JOIN fornitori f ON r.fornitore = f.id
        WHERE r.guasto = ? AND r.is_deleted = 0`, [id]
      );
      return ricambi
    } catch (error) {
      console.log(error)
    }
  }


  async update(id: number, updateGuastiDto: UpdateGuastiDto) {
    try {
      const { stato, data_guasto, descrizione, preventivo_riparazione, costo_riparazione, costo_dealer } = updateGuastiDto;

      const result = await this.dataSource.query(
        `UPDATE guasti SET 
        stato = ?, 
        data_guasto = ?, 
        descrizione = ?, 
        preventivo_riparazione = ?, 
        costo_riparazione = ?, 
        costo_dealer = ? 
       WHERE id = ?`,
        [stato, format(data_guasto, "yyyy-MM-dd"), descrizione, preventivo_riparazione, costo_riparazione, costo_dealer, id]
      );

      // Verifica si alguna fila fue afectada
      if (result.affectedRows === 0) {
        throw new Error(`No se encontró un guasto con id: ${id}`);
      }

      return { message: 'Guasto actualizado con éxito', data: result };
    } catch (error) {
      console.error("Error al actualizar el guasto:", error);
      throw new Error('Error al actualizar el guasto');
    }
  }


  async remove(id: number) {
    try {
      const guasti = await this.dataSource.query(
        `UPDATE guasti SET is_deleted = 1 WHERE id = ?`, [id]
      );

      await this.dataSource.query(
        `UPDATE guasti__eventi SET is_deleted = 1 WHERE guasto = ?`, [id]
      );

      return guasti[0]
    } catch (error) {
      console.log(error)
    }
  }

  applyFilters(query: SelectQueryBuilder<any>, search: Guasti): void {
    // Lista de campos válidos para filtrar (excluyendo page y limit)

    const validFields = Object.keys(search).filter(key => !['page', 'limit', 'sort', 'order'].includes(key));

    validFields.forEach(key => {
      const value = search[key];
      if (value !== undefined && value !== null && value !== '') {

        if (value && key === 'data_guasto') {
          const newValue = JSON.parse(value)

          const fromDate = newValue.from;
          const toDate = newValue.to;
          query.andWhere(
            `DATE(g.${key}) BETWEEN :${key}From AND :${key}To`,
            {
              [`${key}From`]: fromDate,
              [`${key}To`]: toDate
            }
          )
        }

        if (key === 'dealer') {
          query.andWhere(`g.idDealer = :${key}`, { [key]: `${value}` });
        }

        if (typeof value === 'string' && key !== 'data_guasto' && key !== 'dealer') {
          query.andWhere(`g.${key} LIKE :${key}`, { [key]: `%${value}%` });
        } else if (typeof value === 'number') {
          query.andWhere(`g.${key} = :${key}`, { [key]: value });
        }
      }
    });
  }

  private validateUser(email: string): Promise<User | any> {

    const user = this.usersService.findByUsername(email)

    if (!user) throw new NotFoundException('Usuario no encontrado');

    return user;
  }
}
