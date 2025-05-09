// mail.service.ts
import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { join } from 'path';
import { FtpServiceService } from 'src/ftp-service/ftp-service.service';

interface Producto {
    id: number;
    cantidad: number;
    denominazione: string;
}

@Injectable()
export class MailService {
    constructor(
        @InjectQueue('mail-queue') private mailQueue: Queue,
        private readonly ftpService: FtpServiceService

    ) { }


    async sendMailWithAttachment(data: {
        to: string,
        subject: string,
        html: string,
        attachments?: any[]
    }) {
        // Añade trabajo a la cola
        await this.mailQueue.add('send-mail', data, {
            attempts: 3,
            backoff: {
                type: 'exponential',
                delay: 1000
            }
        });
    }

    async sendGarantiasEmail(email: string, cc: any, bcc: any, productos: Producto[], dealer: string) {
        const data = {
            to: email,
            cc: cc,
            bcc: bcc,
            subject: 'Disponibilità di garanzie rimanenti: ' + dealer,
            template: 'invio',
            context: {
                fecha: new Date().toLocaleDateString('it-IT'),
                productos: productos.map(prod => ({
                    ...prod,
                    colorClass: this.getColorClass(prod.cantidad),
                })),
            },
            attachments: [
                {
                    filename: 'logo_grey.png',
                    path: join(__dirname, '../assets/assets/logo_grey.png'),
                    cid: 'logo',
                },
            ],
        };

        await this.mailQueue.add('send-template-mail', data, {
            attempts: 3,
            backoff: {
                type: 'exponential',
                delay: 1000,
            },
        });
    }

    async sendSignUpEmail(email: string, cc: any, bcc: any, nome: string) {

        const data = {
            to: email,
            cc: cc,
            bcc: bcc,
            subject: 'Registrazione Dealer avvenuta con successo',
            template: 'signup',
            context: {
                nomeDealer: nome,
                emailDealer: email,
            },
            attachments: [
                {
                    filename: 'logo_grey.png',
                    path: join(__dirname, '../assets/assets/logo_grey.png'),
                    cid: 'logo',
                },
            ],
        };
        console.log('data__ ', data)
        await this.mailQueue.add('send-template-mail', data, {
            attempts: 3,
            backoff: {
                type: 'exponential',
                delay: 1000,
            },
        });


    }

    async sendProformaEmail(email: string, cc: any, bcc: any, proformaNumber: any, solleciti, proformaDate, subject: string, template: string) {

        try {
            // Ruta del archivo en el servidor FTP
            const filePath = `/httpdocs/storage/prova/${proformaNumber}.pdf`;

            // Obtener el archivo del servidor FTP
            const fileBuffer = await this.ftpService.getFileV2(filePath);
            if (!Buffer.isBuffer(fileBuffer)) {
                throw new Error(`El archivo descargado no es un buffer válido (Tipo recibido: ${typeof fileBuffer})`);
            }
            console.log(`Buffer válido recibido. Tamaño: ${fileBuffer.length} bytes`);

            const data = {
                to: email,
                cc: cc,
                bcc: bcc,
                subject: subject,
                template: join('proforma', template),
                context: {
                    num_proforma: proformaNumber,
                    data_proforma: proformaDate,
                    solleciti: solleciti, // array of dates
                },
                attachments: [
                    {
                        filename: 'logo_grey.png',
                        path: join(__dirname, '../assets/assets/logo_grey.png'),
                        cid: 'logo',
                    },
                    {
                        filename: `Proforma_${proformaNumber}.pdf`,
                        content: fileBuffer.toString('base64'),
                        encoding: 'base64',
                        contentType: 'application/pdf'
                    },
                ],
            };

            // Encolar el correo
            const result = await this.mailQueue.add('send-template-mail', data, {
                attempts: 3,
                backoff: {
                    type: 'exponential',
                    delay: 1000,
                },
            });

            return { success: true, messageId: result?.id };
        } catch (error) {
            console.error(`Error al enviar correo con proforma ${proformaNumber}:`, error);
            throw new Error(`No se pudo enviar el correo: ${error.message}`);
        }


    }

    async sendFattureEmail(email: string, cc: any, bcc: any, num_fattura: any, data_fattura: any, subject: any) {
        const data = {
            to: email,
            cc: cc,
            bcc: bcc,
            subject: subject,
            template: join('fatture', 'fattura'),
            context: {
                num_fattura: num_fattura,
                data_fattura: data_fattura,
            },
            attachments: [
                {
                    filename: 'logo_grey.png',
                    path: join(__dirname, '../assets/assets/logo_grey.png'),
                    cid: 'logo',
                },
            ],
        };

        await this.mailQueue.add('send-template-mail', data, {
            attempts: 3,
            backoff: {
                type: 'exponential',
                delay: 1000,
            },
        });
    }

    private getColorClass(cantidad: number): string {
        if (cantidad === 0) return '#e80016';
        if (cantidad <= 3) return '#e1a900';
        return '#198754';
    }
}