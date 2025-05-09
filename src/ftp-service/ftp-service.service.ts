import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as ftp from 'basic-ftp';
import { Readable, Writable } from 'stream';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

@Injectable()
export class FtpServiceService {
  constructor(
    private configService: ConfigService
  ) { }

  async getFile(filePath: string): Promise<Buffer> {
    const client = new ftp.Client();

    try {
      await client.access({
        host: this.configService.get('FTP_HOST'),
        user: this.configService.get('FTP_USER'),
        password: this.configService.get('FTP_PASSWORD'),
        secure: this.configService.get('FTP_SECURE') === 'true'
      });


      const chunks: any[] = [];
      const writableStream = new Writable({
        write(chunk, encoding, callback) {
          chunks.push(chunk);
          callback();
        }
      });
      await client.downloadTo(writableStream, filePath);

      return Buffer.concat(chunks);
    } catch (err) {
      console.log(err)
    } finally {
      client.close();
    }
  }

  async getFileV2(filePath: string): Promise<Buffer> {
    const client = new ftp.Client();

    const tempFilePath = path.join(os.tmpdir(), `temp_${Date.now()}.pdf`);


    try {
      await client.access({
        host: this.configService.get('FTP_HOST'),
        user: this.configService.get('FTP_USER'),
        password: this.configService.get('FTP_PASSWORD'),
        secure: this.configService.get('FTP_SECURE') === 'true'
      });

      await client.downloadTo(tempFilePath, filePath);
      const fileBuffer = fs.readFileSync(tempFilePath);
      return fileBuffer;
    } catch (err) {
      console.error(`Error al obtener archivo FTP ${filePath}:`, err);
      throw new Error(`No se pudo descargar el archivo: ${err.message}`);
    } finally {
      client.close();
    }
  }

  async uploadFile(buffer: any, remotePath: string): Promise<void> {
    // Crear el cliente FTP fuera del try/catch para asegurar que se cierre correctamente
    const client = new ftp.Client();
    client.ftp.verbose = false; // Desactivar logs verbosos para mejorar rendimiento

    try {
      // Usar configuración cacheada para evitar múltiples llamadas a configService
      const ftpConfig = {
        host: this.configService.get('FTP_HOST'),
        user: this.configService.get('FTP_USER'),
        password: this.configService.get('FTP_PASSWORD'),
        secure: this.configService.get('FTP_SECURE') === 'true',
        // Añadir timeouts para evitar conexiones colgadas
        timeout: 30000
      };

      await client.access(ftpConfig);

      // Mejorar manejo de stream
      const readable = new Readable({
        read() { } // Implementación requerida
      });

      // Controlar errores de stream
      readable.on('error', (err) => {
        throw new Error(`Stream error: ${err.message}`);
      });

      // Enviar datos al stream
      readable.push(buffer);
      readable.push(null);

      // Añadir retry logic para mayor robustez
      const maxRetries = 3;
      let attempts = 0;
      let uploaded = false;

      while (!uploaded && attempts < maxRetries) {
        try {
          attempts++;
          await client.uploadFrom(readable, remotePath);
          uploaded = true;
        } catch (uploadError) {
          if (attempts >= maxRetries) {
            throw uploadError;
          }
          // Esperar antes de reintentar (backoff exponencial)
          await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, attempts - 1)));
          // Reiniciar el stream para el siguiente intento
          readable.push(buffer);
          readable.push(null);
        }
      }

      return;
    } catch (err) {
      console.error(`FTP upload error for ${remotePath}:`, err);
      throw new Error(`Failed to upload file to FTP: ${err.message}`);
    } finally {
      // Asegurarse de que el cliente se cierre incluso si hay errores
      try {
        await client.close();
      } catch (closeError) {
        console.error('Error closing FTP client:', closeError);
      }
    }
  }

  async deleteFile(remotePath: string): Promise<boolean> {
    const client = new ftp.Client();

    try {
      await client.access({
        host: this.configService.get('FTP_HOST'),
        user: this.configService.get('FTP_USER'),
        password: this.configService.get('FTP_PASSWORD'),
        secure: this.configService.get('FTP_SECURE') === 'true'
      });

      // Verificar si el archivo existe antes de intentar borrarlo
      try {
        await client.size(remotePath);
      } catch (err) {
        console.log('File not found:', remotePath);
        return false;
      }

      // Borrar el archivo
      await client.remove(remotePath);
      return true;
    } catch (err) {
      console.error('FTP delete error:', err);
      throw err;
    } finally {
      client.close();
    }
  }
}
