import { Injectable } from '@nestjs/common';
import { CreateLogDto } from './dto/create-log.dto';
import { UpdateLogDto } from './dto/update-log.dto';
import { InjectDataSource, InjectEntityManager } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';

@Injectable()
export class LogService {

  constructor(

    @InjectEntityManager() private entityManager: EntityManager,

    @InjectDataSource() private dataSource: DataSource

  ) { }

  async create(operazione: number, record_table: string, record_id: any, oldVal?: any, newVal?: any, user?: string) {
    await this.entityManager
      .createQueryBuilder()
      .insert()
      .into('log') // Assuming a 'log' table
      .values({
        user: user,
        operazione: operazione,
        record_table: record_table,
        record_id: record_id,
        oldVal: JSON.stringify(oldVal),
        newVal: JSON.stringify(newVal)
      })
      .execute();
  }

}
