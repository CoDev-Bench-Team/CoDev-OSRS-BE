import { Module } from '@nestjs/common';
import nodemailer, { type Transporter } from 'nodemailer';
import { MailerService } from './mailer.service.js';

@Module({
    providers: [
        {
            provide: 'MAIL_TRANSPORTER',
            useFactory: async (): Promise<Transporter> => {
                const transporter = nodemailer.createTransport({
                    host: process.env.SMTP_HOST,
                    port: parseInt(process.env.SMTP_PORT ?? '587', 10),
                    auth: {
                        user: process.env.SMTP_USER,
                        pass: process.env.SMTP_PASSWORD,
                    },
                });

                await transporter.verify();
                return transporter;
            },
        },
        MailerService,
    ],
    exports: [MailerService]
})
export class MailerModule {}
