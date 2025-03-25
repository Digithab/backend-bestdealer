import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as ftp from 'basic-ftp';
import { Readable, Writable } from 'stream';

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

  async uploadFile(buffer: any, remotePath: string): Promise<void> {
    const client = new ftp.Client();

    try {
      await client.access({
        host: this.configService.get('FTP_HOST'),
        user: this.configService.get('FTP_USER'),
        password: this.configService.get('FTP_PASSWORD'),
        secure: this.configService.get('FTP_SECURE') === 'true'
      });

      const readable = new Readable();
      readable.push(buffer);
      readable.push(null);

      await client.uploadFrom(readable, remotePath);
    } catch (err) {
      console.error('FTP upload error:', err);
      throw err;
    } finally {
      client.close();
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
