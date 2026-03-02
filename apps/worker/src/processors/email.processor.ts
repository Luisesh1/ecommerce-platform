import { Process, Processor, OnQueueFailed, OnQueueCompleted } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { Resend } from 'resend';
import { ConfigService } from '@nestjs/config';

export interface SendEmailJobData {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  from?: string;
  replyTo?: string;
  attachments?: Array<{
    filename: string;
    content: string; // base64 encoded
    contentType: string;
  }>;
}

@Processor('emails')
export class EmailProcessor {
  private readonly logger = new Logger(EmailProcessor.name);
  private readonly resend: Resend;
  private readonly defaultFrom: string;

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('RESEND_API_KEY');
    if (!apiKey) {
      this.logger.warn('RESEND_API_KEY not configured — emails will not be sent');
    }
    this.resend = new Resend(apiKey);
    this.defaultFrom = this.configService.get<string>(
      'EMAIL_FROM',
      'Ecommerce <noreply@example.com>',
    );
  }

  @Process('send-email')
  async handleSendEmail(job: Job<SendEmailJobData>): Promise<void> {
    const { to, subject, html, text, from, replyTo, attachments } = job.data;

    this.logger.debug(`Processing send-email job ${job.id} to ${JSON.stringify(to)}`);

    const payload: Parameters<typeof this.resend.emails.send>[0] = {
      from: from ?? this.defaultFrom,
      to: Array.isArray(to) ? to : [to],
      subject,
      html,
    };

    if (text) payload.text = text;
    if (replyTo) payload.reply_to = replyTo;
    if (attachments && attachments.length > 0) {
      payload.attachments = attachments.map((a) => ({
        filename: a.filename,
        content: Buffer.from(a.content, 'base64'),
      }));
    }

    const result = await this.resend.emails.send(payload);

    if ('error' in result && result.error) {
      this.logger.error(
        `Resend API error for job ${job.id}: ${JSON.stringify(result.error)}`,
      );
      throw new Error(`Resend error: ${result.error.message}`);
    }

    this.logger.log(
      `Email sent successfully to ${JSON.stringify(to)} | subject: "${subject}" | id: ${(result as any).data?.id}`,
    );
  }

  @OnQueueFailed()
  onFailed(job: Job<SendEmailJobData>, error: Error): void {
    this.logger.error(
      `Email job ${job.id} failed after ${job.attemptsMade} attempt(s): ${error.message}`,
      error.stack,
    );
  }

  @OnQueueCompleted()
  onCompleted(job: Job<SendEmailJobData>): void {
    this.logger.debug(`Email job ${job.id} completed`);
  }
}
