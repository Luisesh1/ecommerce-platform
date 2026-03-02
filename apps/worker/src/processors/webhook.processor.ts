import { Process, Processor, OnQueueFailed } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { PrismaService } from '../prisma.service';

export interface WebhookJobData {
  provider: 'stripe' | 'paypal' | 'conekta' | 'openpay';
  event: string;
  payload: Record<string, any>;
  receivedAt: string;
}

@Processor('webhooks')
export class WebhookProcessor {
  private readonly logger = new Logger(WebhookProcessor.name);

  constructor(private readonly prisma: PrismaService) {}

  @Process('process-webhook')
  async handleProcessWebhook(job: Job<WebhookJobData>): Promise<void> {
    const { provider, event, payload } = job.data;
    this.logger.log(`Processing webhook [${provider}] ${event} — job ${job.id}`);

    switch (provider) {
      case 'stripe':
        await this.handleStripeEvent(event, payload);
        break;
      case 'conekta':
        await this.handleConektaEvent(event, payload);
        break;
      default:
        this.logger.warn(`Unhandled webhook provider: ${provider}`);
    }
  }

  // ─── Stripe ────────────────────────────────────────────────────────────────

  private async handleStripeEvent(event: string, payload: Record<string, any>): Promise<void> {
    switch (event) {
      case 'payment_intent.succeeded':
        await this.onPaymentIntentSucceeded(payload);
        break;
      case 'payment_intent.payment_failed':
        await this.onPaymentIntentFailed(payload);
        break;
      case 'charge.refunded':
        await this.onChargeRefunded(payload);
        break;
      case 'checkout.session.completed':
        await this.onCheckoutSessionCompleted(payload);
        break;
      default:
        this.logger.debug(`Unhandled Stripe event: ${event}`);
    }
  }

  private async onPaymentIntentSucceeded(payload: Record<string, any>): Promise<void> {
    const paymentIntentId: string = payload?.data?.object?.id ?? payload?.id;
    const metadata: Record<string, string> = payload?.data?.object?.metadata ?? payload?.metadata ?? {};
    const orderId: string | undefined = metadata?.orderId;

    if (!orderId) {
      this.logger.warn(`payment_intent.succeeded: no orderId in metadata — PI ${paymentIntentId}`);
      return;
    }

    await this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({ where: { id: orderId } });
      if (!order) {
        this.logger.warn(`Order ${orderId} not found for PI ${paymentIntentId}`);
        return;
      }

      await tx.order.update({
        where: { id: orderId },
        data: {
          paymentStatus: 'PAID',
          status: order.status === 'PENDING_PAYMENT' ? 'CONFIRMED' : order.status,
          paidAt: new Date(),
        },
      });

      // Record payment intent on payment record if it exists
      await tx.payment.updateMany({
        where: { orderId, status: 'PENDING' },
        data: {
          status: 'COMPLETED',
          providerPaymentId: paymentIntentId,
          paidAt: new Date(),
        },
      });
    });

    this.logger.log(`Order ${orderId} marked as PAID (PI: ${paymentIntentId})`);
  }

  private async onPaymentIntentFailed(payload: Record<string, any>): Promise<void> {
    const paymentIntentId: string = payload?.data?.object?.id ?? payload?.id;
    const metadata: Record<string, string> = payload?.data?.object?.metadata ?? payload?.metadata ?? {};
    const orderId: string | undefined = metadata?.orderId;
    const failureMessage: string = payload?.data?.object?.last_payment_error?.message ?? 'Payment failed';

    if (!orderId) {
      this.logger.warn(`payment_intent.payment_failed: no orderId in metadata — PI ${paymentIntentId}`);
      return;
    }

    await this.prisma.order.update({
      where: { id: orderId },
      data: { paymentStatus: 'FAILED' },
    });

    await this.prisma.payment.updateMany({
      where: { orderId, status: 'PENDING' },
      data: {
        status: 'FAILED',
        providerPaymentId: paymentIntentId,
        failureReason: failureMessage,
      },
    });

    this.logger.warn(`Order ${orderId} payment FAILED (PI: ${paymentIntentId}): ${failureMessage}`);
  }

  private async onChargeRefunded(payload: Record<string, any>): Promise<void> {
    const charge = payload?.data?.object ?? payload;
    const paymentIntentId: string = charge?.payment_intent;
    const amountRefunded: number = charge?.amount_refunded ?? 0; // cents
    const currency: string = charge?.currency ?? 'mxn';

    if (!paymentIntentId) {
      this.logger.warn('charge.refunded: missing payment_intent');
      return;
    }

    const payment = await this.prisma.payment.findFirst({
      where: { providerPaymentId: paymentIntentId },
      include: { order: true },
    });

    if (!payment) {
      this.logger.warn(`No payment found for PI ${paymentIntentId}`);
      return;
    }

    const refunds: Array<Record<string, any>> = charge?.refunds?.data ?? [];

    await this.prisma.$transaction(async (tx) => {
      for (const refund of refunds) {
        // Upsert refund record keyed on provider refund ID
        const existingRefund = await tx.refund.findFirst({
          where: { providerRefundId: refund.id },
        });

        if (!existingRefund) {
          await tx.refund.create({
            data: {
              orderId: payment.orderId,
              paymentId: payment.id,
              amount: refund.amount,
              currency: currency.toUpperCase(),
              status: refund.status === 'succeeded' ? 'COMPLETED' : 'PENDING',
              providerRefundId: refund.id,
              reason: refund.reason ?? 'requested_by_customer',
            },
          });
        }
      }

      // If fully refunded update order status
      const order = payment.order;
      if (amountRefunded >= order.totalCents) {
        await tx.order.update({
          where: { id: order.id },
          data: { status: 'REFUNDED', paymentStatus: 'REFUNDED' },
        });
      } else if (amountRefunded > 0) {
        await tx.order.update({
          where: { id: order.id },
          data: { paymentStatus: 'PARTIALLY_REFUNDED' },
        });
      }
    });

    this.logger.log(
      `Refund processed for order ${payment.orderId}: ${amountRefunded} ${currency}`,
    );
  }

  private async onCheckoutSessionCompleted(payload: Record<string, any>): Promise<void> {
    const session = payload?.data?.object ?? payload;
    const paymentIntentId: string = session?.payment_intent;
    const metadata: Record<string, string> = session?.metadata ?? {};
    const orderId: string | undefined = metadata?.orderId;

    if (!orderId) {
      this.logger.warn('checkout.session.completed: no orderId in metadata');
      return;
    }

    if (session?.payment_status === 'paid') {
      await this.prisma.order.update({
        where: { id: orderId },
        data: {
          paymentStatus: 'PAID',
          status: 'CONFIRMED',
          paidAt: new Date(),
        },
      });

      if (paymentIntentId) {
        await this.prisma.payment.updateMany({
          where: { orderId, status: 'PENDING' },
          data: { status: 'COMPLETED', providerPaymentId: paymentIntentId, paidAt: new Date() },
        });
      }

      this.logger.log(`Order ${orderId} confirmed via checkout.session.completed`);
    }
  }

  // ─── Conekta ───────────────────────────────────────────────────────────────

  private async handleConektaEvent(event: string, payload: Record<string, any>): Promise<void> {
    switch (event) {
      case 'order.paid':
        await this.onConektaOrderPaid(payload);
        break;
      case 'order.expired':
        await this.onConektaOrderExpired(payload);
        break;
      default:
        this.logger.debug(`Unhandled Conekta event: ${event}`);
    }
  }

  private async onConektaOrderPaid(payload: Record<string, any>): Promise<void> {
    const conektaOrderId: string = payload?.data?.object?.id ?? payload?.id;
    const metadata: Record<string, string> = payload?.data?.object?.metadata ?? {};
    const orderId: string | undefined = metadata?.orderId;

    if (!orderId) {
      this.logger.warn(`Conekta order.paid: no orderId in metadata — ${conektaOrderId}`);
      return;
    }

    await this.prisma.order.update({
      where: { id: orderId },
      data: { paymentStatus: 'PAID', status: 'CONFIRMED', paidAt: new Date() },
    });

    this.logger.log(`Conekta order ${conektaOrderId} paid → order ${orderId} CONFIRMED`);
  }

  private async onConektaOrderExpired(payload: Record<string, any>): Promise<void> {
    const conektaOrderId: string = payload?.data?.object?.id ?? payload?.id;
    const metadata: Record<string, string> = payload?.data?.object?.metadata ?? {};
    const orderId: string | undefined = metadata?.orderId;

    if (!orderId) return;

    await this.prisma.order.update({
      where: { id: orderId },
      data: { paymentStatus: 'FAILED', status: 'CANCELLED' },
    });

    this.logger.warn(`Conekta order ${conektaOrderId} expired → order ${orderId} CANCELLED`);
  }

  // ─── Error handling ────────────────────────────────────────────────────────

  @OnQueueFailed()
  onFailed(job: Job<WebhookJobData>, error: Error): void {
    this.logger.error(
      `Webhook job ${job.id} [${job.data.provider}:${job.data.event}] failed after ${job.attemptsMade} attempt(s): ${error.message}`,
      error.stack,
    );
  }
}
