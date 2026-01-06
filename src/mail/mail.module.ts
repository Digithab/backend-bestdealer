// mail.module.ts
import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { MailService } from './mail.service';
import { MailProcessor } from './mail.processor';
import { join } from 'path';
import { MailerModule } from '@nestjs-modules/mailer';
import { HandlebarsAdapter } from '@nestjs-modules/mailer/dist/adapters/handlebars.adapter';
import { FtpServiceModule } from 'src/ftp-service/ftp-service.module';
import { UsersModule } from 'src/modules/users/users.module';
import { User } from 'src/modules/users/interface/user-interface';
require('dotenv').config();

@Module({
    imports: [
        FtpServiceModule,
        BullModule.forRoot({
            redis: {
                host: 'localhost', // 10.114.0.4 - localhost
                port: 6379,
                maxRetriesPerRequest: null,
                enableReadyCheck: false,
                retryStrategy: (times: number) => {
                    return Math.min(times * 50, 2000);
                }
            }
        }),
        BullModule.registerQueue({
            name: 'mail-queue',
        }),
        MailerModule.forRoot({
            transport: {
                host: 'smtp.ergonet.it', // Ajusta según tu proveedor
                secure: false,
                port: 587,
                auth: {
                    user: process.env.MAIL_USER,
                    pass: process.env.MAIL_PASSWORD,
                },
                tls: {
                    rejectUnauthorized: false // Añadido para desarrollo
                }
            },
            defaults: {
                from: process.env.MAIL_USER,
            },
            template: {
                dir: join(__dirname, '..', 'mail', 'templates'),
                adapter: new HandlebarsAdapter(),
                options: {
                    strict: true,
                },
            },
        }),
    ],
    providers: [MailService, MailProcessor],
    exports: [MailService, BullModule]
})
export class MailModule { }