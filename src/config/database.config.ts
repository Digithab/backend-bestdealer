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
    // Configuración mejorada de reconexión
    retryAttempts: 5, // Intentar reconectar indefinidamente
    retryDelay: 3000,
    autoLoadEntities: false,
    // Pool de conexiones optimizado
    extra: {
        // Pool más grande para mejor rendimiento
        connectionLimit: 30,
        // Timeouts optimizados
        connectTimeout: 30000,    // 30 segundos
        // Configuración de keepalive
        enableKeepAlive: true,
        keepAliveInitialDelay: 30000, // 10 segundos
        // Manejo de conexiones
        waitForConnections: true,
        queueLimit: 100,          // Limita la cola para evitar sobrecarga
        dateStrings: true,       // Mejor manejo de fechas
        multipleStatements: true,
        supportBigNumbers: true,
        bigNumberStrings: false, // Mejor rendimiento con números grandes
    },
    // Configuración general de TypeORM
    keepConnectionAlive: true,
    connectTimeout: 30000,
    maxQueryExecutionTime: 10000, // Alerta de queries lentos después de 10s
    cache: {
        type: "database", // Activar caché para consultas frecuentes
        duration: 30000 // 30 segundos
    },
};