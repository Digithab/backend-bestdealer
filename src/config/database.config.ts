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
    logging: false, // Opcional: muestra las consultas SQL en la consola

    // Configuración mejorada de reconexión
    retryAttempts: Infinity, // Intentar reconectar indefinidamente
    retryDelay: 3000,
    autoLoadEntities: true,

    // Pool de conexiones optimizado
    extra: {
        // Pool más grande para mejor rendimiento
        connectionLimit: 20,

        // Timeouts optimizados
        connectTimeout: 30000,    // 30 segundos
        acquireTimeout: 30000,    // 30 segundos para adquirir conexión del pool
        timeout: 60000,          // Timeout general de 60 segundos

        // Configuración de keepalive
        enableKeepAlive: true,
        keepAliveInitialDelay: 10000, // 10 segundos

        // Manejo de conexiones
        waitForConnections: true,
        queueLimit: 50,          // Limita la cola para evitar sobrecarga

        // Validación de conexiones
        validateConnection: true,
        dateStrings: true,       // Mejor manejo de fechas
    },

    // Configuración general de TypeORM
    keepConnectionAlive: true,
    connectTimeout: 30000,
    maxQueryExecutionTime: 10000, // Alerta de queries lentos después de 10s

};