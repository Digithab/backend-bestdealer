import { TypeOrmModuleOptions } from '@nestjs/typeorm';

require('dotenv').config();

export const typeOrmConfig: TypeOrmModuleOptions = {
    type: 'mysql',
    host: process.env.DB_HOST,
    port: 3306,
    username: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    entities: [], // Dejamos esto vacío ya que no usaremos entidades
    synchronize: false, // Importante: esto evita que TypeORM modifique tu esquema
    logging: true, // Opcional: muestra las consultas SQL en la consola
};