import {
  Injectable,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { PaymentGateway, WebhookEventStatus, PaymentStatus, OrderStatus } from '@prisma/client';
import * as crypto from 'crypto';

@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name);
  private readonly MAX_ATTEMPTS = 3;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    @InjectQueue('webhooks') private readonly webhooksQueue: Queue,
  ) {}

  async receiveStripeWebhook(rawPayload: Buffer, signature: string): Promise<void> {
    const webhookSecret = this.configService.get<string>('STRIPE_WEBHOOK_SECRET');
    if (!webhookSecret) throw new BadRequestException('Stripe webhook not configured');

    let event: any;
    try {
      const Stripe = require('stripe');
      const stripe = new Stripe('dummy');
      event = stripe.webhooks.constructEvent(rawPayload, signature, webhookSecret);
    } catch (err) {
      throw new BadRequestException(`Stripe signature verification failed: ${(err as Error).message}`);
    }

    await this.queueWebhookEvent(PaymentGateway.STRIPE, event.id, event.type, event);
  }

  async receiveMercadoPagoWebhook(body: any, headers: Record<string, string>): Promise<void> {
    const eventId = body.id?.toString() || `mp-${Date.now()}`;
    const eventType = body.type || body.topic;

    await this.queueWebhookEvent(PaymentGateway.MERCADOPAGO, eventId, eventType, body);
  }

  async receivePayPalWebhook(body: any, headers: Record<string, string>): Promise<void> {
    const eventId = body.id || `pp-${Date.now()}`;
    const eventType = body.event_type;

    await this.queueWebhookEvent(PaymentGateway.PAYPAL, eventId, eventType, body);
  }

  private async queueWebhookEvent(
    gateway: PaymentGateway,
    eventId: string,
    eventType: string,
    payload: any,
  ): Promise<void> {
    const existing = await this.prisma.webhookEvent.findUnique({
      where: { gateway_eventId: { gateway, eventId } },
    });

    if (existing) {
      this.logger.warn(`Duplicate webhook event ${eventId} for ${gateway}, skipping`);
      return;
    }

    const event = await this.prisma.webhookEvent.create({
      data: {
        gateway,
        eventId,
        eventType,
        payload,
        status: WebhookEventStatus.PENDING,
      },
    });

    await this.webhooksQueue.add(
      'process-webhook',
      { eventId: event.id },
      {
        attempts: this.MAX_ATTEMPTS,
        backoff: { type: 'exponential', delay: 5000 },
      },
    );
  }

  async handleStripeWebhook(
    rawPayload: Buffer,
    signature: string,
  ): Promise<{ skipped: boolean } | void> {
    const webhookSecret = this.configService.get<string>('STRIPE_WEBHOOK_SECRET');
    if (!webhookSecret) throw new BadRequestException('Stripe webhook not configured');

    let event: any;
    try {
      const Stripe = require('stripe');
      const stripe = new Stripe('dummy');
      event = stripe.webhooks.constructEvent(rawPayload, signature, webhookSecret);
    } catch (err) {
      throw new BadRequestException(`Stripe signature verification failed: ${(err as Error).message}`);
    }

    const existing = await this.prisma.webhookEvent.findUnique({
      where: { gateway_eventId: { gateway: PaymentGateway.STRIPE, eventId: event.id } },
    });
    if (existing) {
      this.logger.warn(`Duplicate/in-flight Stripe event ${event.id}, skipping`);
      return { skipped: true };
    }

    const record = await this.prisma.webhookEvent.create({
      data: {
        gateway: PaymentGateway.STRIPE,
        eventId: event.id,
        eventType: event.type,
        payload: event,
        status: WebhookEventStatus.PENDING,
      },
    });

    await this.webhooksQueue.add(
      'process-webhook',
      { eventId: record.id },
      { attempts: this.MAX_ATTEMPTS, backoff: { type: 'exponential', delay: 5000 } },
    );
  }

  async handleFailedWebhook(webhookEventId: string): Promise<void> {
    const event = await this.prisma.webhookEvent.findUnique({ where: { id: webhookEventId } });
    if (!event) return;

    if (event.status === WebhookEventStatus.DEAD_LETTER) return;

    if (event.processingAttempts >= this.MAX_ATTEMPTS) {
      await this.prisma.webhookEvent.update({
        where: { id: webhookEventId },
        data: {
          status: WebhookEventStatus.DEAD_LETTER,
          lastError: event.lastError ?? 'Max retries exceeded',
        },
      });
    } else {
      await this.prisma.webhookEvent.update({
        where: { id: webhookEventId },
        data: { status: WebhookEventStatus.PENDING, processingAttempts: { increment: 1 } },
      });
      await this.webhooksQueue.add(
        'process-webhook',
        { eventId: webhookEventId },
        { attempts: this.MAX_ATTEMPTS, backoff: { type: 'exponential', delay: 5000 } },
      );
    }
  }

  async processWebhookEvent(webhookEventId: string): Promise<void> {
    const event = await this.prisma.webhookEvent.findUnique({ where: { id: webhookEventId } });
    if (!event) throw new Error(`Webhook event ${webhookEventId} not found`);

    await this.prisma.webhookEvent.update({
      where: { id: webhookEventId },
      data: {
        status: WebhookEventStatus.PROCESSING,
        processingAttempts: { increment: 1 },
      },
    });

    try {
      await this.handleEventByType(event);

      await this.prisma.webhookEvent.update({
        where: { id: webhookEventId },
        data: { status: WebhookEventStatus.PROCESSED, processedAt: new Date() },
      });
    } catch (err) {
      const attempts = event.processingAttempts + 1;
      const status =
        attempts >= this.MAX_ATTEMPTS
          ? WebhookEventStatus.DEAD_LETTER
          : WebhookEventStatus.FAILED;

      await this.prisma.webhookEvent.update({
        where: { id: webhookEventId },
        data: { status, lastError: (err as Error).message },
      });

      throw err;
    }
  }

  private async handleEventByType(event: any): Promise<void> {
    const payload = event.payload as any;

    if (event.gateway === PaymentGateway.STRIPE) {
      switch (event.eventType) {
        case 'payment_intent.succeeded':
          await this.handleStripePaymentSucceeded(payload);
          break;
        case 'payment_intent.payment_failed':
          await this.handleStripePaymentFailed(payload);
          break;
        case 'charge.dispute.created':
          await this.handleChargeDispute(payload);
          break;
        default:
          this.logger.log(`Unhandled Stripe event: ${event.eventType}`);
      }
    } else if (event.gateway === PaymentGateway.MERCADOPAGO) {
      if (event.eventType === 'payment') {
        await this.handleMercadoPagoPayment(payload);
      }
    } else if (event.gateway === PaymentGateway.PAYPAL) {
      if (event.eventType === 'PAYMENT.CAPTURE.COMPLETED') {
        await this.handlePayPalCapture(payload);
      }
    }
  }

  private async handleStripePaymentSucceeded(payload: any): Promise<void> {
    const gatewayPaymentId = payload.data?.object?.id;
    if (!gatewayPaymentId) return;

    const payment = await this.prisma.payment.findFirst({
      where: { gatewayPaymentId },
    });
    if (!payment) return;

    await this.prisma.payment.update({
      where: { id: payment.id },
      data: { status: PaymentStatus.CAPTURED },
    });

    await this.prisma.order.update({
      where: { id: payment.orderId },
      data: { status: OrderStatus.CONFIRMED, paymentStatus: PaymentStatus.PAID },
    });
  }

  private async handleStripePaymentFailed(payload: any): Promise<void> {
    const gatewayPaymentId = payload.data?.object?.id;
    if (!gatewayPaymentId) return;

    const payment = await this.prisma.payment.findFirst({ where: { gatewayPaymentId } });
    if (!payment) return;

    await this.prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: PaymentStatus.FAILED,
        failureCode: payload.data?.object?.last_payment_error?.code,
        failureMessage: payload.data?.object?.last_payment_error?.message,
      },
    });

    await this.prisma.order.update({
      where: { id: payment.orderId },
      data: { status: OrderStatus.PAYMENT_FAILED, paymentStatus: PaymentStatus.FAILED },
    });
  }

  private async handleChargeDispute(payload: any): Promise<void> {
    const paymentIntentId = payload.data?.object?.payment_intent;
    if (!paymentIntentId) return;

    const payment = await this.prisma.payment.findFirst({ where: { gatewayPaymentId: paymentIntentId } });
    if (!payment) return;

    await this.prisma.payment.update({
      where: { id: payment.id },
      data: { status: PaymentStatus.CHARGEBACK },
    });
  }

  private async handleMercadoPagoPayment(payload: any): Promise<void> {
    const externalRef = payload.data?.id;
    if (!externalRef) return;
    this.logger.log(`MercadoPago payment processed: ${externalRef}`);
  }

  private async handlePayPalCapture(payload: any): Promise<void> {
    const captureId = payload.resource?.id;
    if (!captureId) return;
    this.logger.log(`PayPal capture processed: ${captureId}`);
  }
}
