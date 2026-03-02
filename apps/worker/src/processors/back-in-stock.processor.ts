import { Process, Processor, OnQueueFailed } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { Resend } from 'resend';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma.service';

export interface BackInStockJobData {
  variantId: string;
}

@Processor('back-in-stock')
export class BackInStockProcessor {
  private readonly logger = new Logger(BackInStockProcessor.name);
  private readonly resend: Resend;
  private readonly defaultFrom: string;
  private readonly storeUrl: string;
  private readonly storeName: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    this.resend = new Resend(this.configService.get<string>('RESEND_API_KEY'));
    this.defaultFrom = this.configService.get<string>(
      'EMAIL_FROM',
      'Ecommerce <noreply@example.com>',
    );
    this.storeUrl = this.configService.get<string>('STORE_URL', 'https://example.com');
    this.storeName = this.configService.get<string>('STORE_NAME', 'Ecommerce');
  }

  @Process('notify-back-in-stock')
  async handleNotifyBackInStock(job: Job<BackInStockJobData>): Promise<void> {
    const { variantId } = job.data;

    this.logger.log(`Processing back-in-stock notifications for variant ${variantId}`);

    // 1. Verify variant is actually in stock
    const variant = await this.prisma.productVariant.findUnique({
      where: { id: variantId },
      include: {
        product: {
          include: {
            images: { take: 1, orderBy: { position: 'asc' } },
          },
        },
      },
    });

    if (!variant) {
      this.logger.warn(`Variant ${variantId} not found`);
      return;
    }

    const availableStock = variant.stockQuantity - variant.reservedQuantity;
    if (availableStock <= 0) {
      this.logger.debug(`Variant ${variantId} is not in stock (available: ${availableStock}) — skipping`);
      return;
    }

    // 2. Fetch pending subscribers who have not been notified yet
    const subscriptions = await this.prisma.backInStockSubscription.findMany({
      where: {
        variantId,
        notifiedAt: null,
        unsubscribedAt: null,
      },
      take: 500, // Process at most 500 per run to avoid very long jobs
    });

    if (subscriptions.length === 0) {
      this.logger.debug(`No pending back-in-stock subscriptions for variant ${variantId}`);
      return;
    }

    this.logger.log(
      `Sending ${subscriptions.length} back-in-stock notification(s) for variant ${variantId}`,
    );

    let sent = 0;
    let failed = 0;

    for (const subscription of subscriptions) {
      try {
        const html = this.buildEmailHtml(variant, subscription.email);

        const result = await this.resend.emails.send({
          from: this.defaultFrom,
          to: subscription.email,
          subject: `¡${variant.product.name} volvió a estar disponible!`,
          html,
        });

        if ('error' in result && result.error) {
          throw new Error(`Resend error: ${result.error.message}`);
        }

        // 3. Mark as notified
        await this.prisma.backInStockSubscription.update({
          where: { id: subscription.id },
          data: { notifiedAt: new Date() },
        });

        sent++;
        this.logger.debug(
          `Back-in-stock notification sent to ${subscription.email} for variant ${variantId}`,
        );
      } catch (err) {
        failed++;
        this.logger.error(
          `Failed to notify ${subscription.email} for variant ${variantId}: ${(err as Error).message}`,
          (err as Error).stack,
        );
      }
    }

    this.logger.log(
      `Back-in-stock notifications complete: ${sent} sent, ${failed} failed`,
    );

    if (failed > 0 && sent === 0) {
      throw new Error(`All ${failed} notifications failed — will retry`);
    }
  }

  // ─── Private helpers ────────────────────────────────────────────────────────

  private buildEmailHtml(
    variant: {
      id: string;
      title: string;
      product: {
        name: string;
        slug: string;
        images: Array<{ url: string; altText?: string | null }>;
      };
      priceCents: number;
      salePriceCents: number | null;
    },
    email: string,
  ): string {
    const productUrl = `${this.storeUrl}/productos/${variant.product.slug}`;
    const imageUrl = variant.product.images[0]?.url ?? `${this.storeUrl}/placeholder.png`;
    const imageAlt = variant.product.images[0]?.altText ?? variant.product.name;

    const price = (variant.salePriceCents ?? variant.priceCents) / 100;
    const priceFormatted = price.toLocaleString('es-MX', {
      style: 'currency',
      currency: 'MXN',
    });

    const unsubscribeUrl = `${this.storeUrl}/back-in-stock/unsubscribe?email=${encodeURIComponent(email)}&variantId=${variant.id}`;

    return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${variant.product.name} volvió a estar disponible — ${this.storeName}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f5f5f5; margin: 0; padding: 24px;">
  <div style="max-width: 560px; margin: 0 auto; background: #fff; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 4px rgba(0,0,0,0.1);">

    <!-- Header -->
    <div style="background: #111; padding: 20px; text-align: center;">
      <a href="${this.storeUrl}" style="color: #fff; font-size: 20px; font-weight: 700; text-decoration: none;">
        ${this.storeName}
      </a>
    </div>

    <!-- Body -->
    <div style="padding: 32px; text-align: center;">
      <h2 style="margin: 0 0 8px; font-size: 22px; color: #111;">
        ¡Buenas noticias!
      </h2>
      <p style="color: #555; margin: 0 0 24px; font-size: 15px;">
        Un artículo de tu lista de deseos volvió a estar disponible.
      </p>

      <!-- Product card -->
      <div style="border: 1px solid #eee; border-radius: 8px; overflow: hidden; margin: 0 auto 24px; max-width: 320px;">
        <a href="${productUrl}">
          <img src="${imageUrl}" alt="${imageAlt}"
            style="width: 100%; height: 220px; object-fit: cover; display: block;" />
        </a>
        <div style="padding: 16px; text-align: left;">
          <p style="margin: 0 0 4px; font-weight: 700; font-size: 16px; color: #111;">
            <a href="${productUrl}" style="text-decoration: none; color: inherit;">
              ${variant.product.name}
            </a>
          </p>
          <p style="margin: 0 0 12px; font-size: 13px; color: #888;">
            ${variant.title}
          </p>
          <p style="margin: 0; font-size: 18px; font-weight: 700; color: #111;">
            ${priceFormatted}
          </p>
        </div>
      </div>

      <!-- CTA button -->
      <a href="${productUrl}"
        style="display: inline-block; background: #111; color: #fff; padding: 14px 32px;
               border-radius: 6px; text-decoration: none; font-weight: 600; font-size: 15px;">
        Comprar ahora
      </a>

      <p style="margin: 24px 0 0; font-size: 12px; color: #aaa;">
        ¡Date prisa! Las existencias son limitadas.
      </p>
    </div>

    <!-- Footer -->
    <div style="padding: 20px; background: #f5f5f5; text-align: center; font-size: 12px; color: #999;">
      <p style="margin: 0 0 4px;">
        Recibiste este correo porque solicitaste una notificación de disponibilidad en
        <a href="${this.storeUrl}" style="color: #888;">${this.storeName}</a>.
      </p>
      <p style="margin: 0;">
        <a href="${unsubscribeUrl}" style="color: #999;">Cancelar notificación</a>
      </p>
    </div>
  </div>
</body>
</html>`;
  }

  @OnQueueFailed()
  onFailed(job: Job<BackInStockJobData>, error: Error): void {
    this.logger.error(
      `Back-in-stock job ${job.id} failed after ${job.attemptsMade} attempt(s): ${error.message}`,
      error.stack,
    );
  }
}
