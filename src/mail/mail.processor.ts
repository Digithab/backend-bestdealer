// mail.processor.ts
import { Process, Processor } from '@nestjs/bull';
import { Job } from 'bull';
import * as nodemailer from 'nodemailer';
import { MailerService } from '@nestjs-modules/mailer';

@Processor('mail-queue')
export class MailProcessor {
    private transporter: nodemailer.Transporter;
    constructor(private readonly mailerService: MailerService) { }


    // @Process('send-mail')
    // async processMail(job: Job) {
    //     const { to, subject, html, attachments } = job.data;

    //     try {
    //         await this.transporter.sendMail({
    //             from: '"Tu Empresa" <tu_email@example.com>',
    //             to,
    //             subject,
    //             html,
    //             attachments
    //         });
    //         return {};
    //     } catch (error) {
    //         // Registra el error
    //         console.error('Error enviando correo', error);
    //         throw error;
    //     }
    // }

    @Process('send-template-mail')
    async handleSendTemplateMail(job: Job) {
        const { to, cc, bcc, subject, template, context, attachments } = job.data;
        try {
            await this.mailerService.sendMail({
                to,
                cc,
                bcc,
                subject,
                template,
                context,
                attachments,
            });

            console.log('CORREO ENVIADO!!');
        } catch (error) {
            console.error('Error sending template email:', error);
            throw error;
        }
    }


}