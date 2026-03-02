import { Process, Processor, OnQueueFailed } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { Resend } from 'resend';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma.service';

export interface AbandonedCartJobData {
  cartId: string;
  /** Email template to use: 'first-reminder' | 'second-reminder' | 'final-reminder' */
  template: 'first-reminder' | 'second-reminder' | 'final-reminder';
}

@Processor('abandoned-carts')
export class AbandonedCartProcessor {
  private readonly logger = new Logger(AbandonedCartProcessor.name);
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

  @Process('send-abandoned-cart-email')
  async handleSendAbandonedCartEmail(job: Job<AbandonedCartJobData>): Promise<void> {
    const { cartId, template } = job.data;

    this.logger.log(`Processing abandoned cart email: cart=${cartId} template=${template}`);

    // 1. Fetch cart with items, product/variant info, and customer
    const cart = await this.prisma.cart.findUnique({
      where: { id: cartId },
      include: {
        customer: true,
        items: {
          include: {
            variant: {
              include: {
                product: {
                  include: {
                    images: { take: 1, orderBy: { position: 'asc' } },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!cart) {
      this.logger.warn(`Cart ${cartId} not found — skipping`);
      return;
    }

    if (!cart.customer?.email) {
      this.logger.debug(`Cart ${cartId} has no customer email — skipping`);
      return;
    }

    if (cart.items.length === 0) {
      this.logger.debug(`Cart ${cartId} is empty — skipping`);
      return;
    }

    // 2. Check if this email template was already sent for this cart
    const alreadySent = await this.prisma.abandonedCartEmail.findFirst({
      where: { cartId, template },
    });

    if (alreadySent) {
      this.logger.debug(
        `Template "${template}" already sent for cart ${cartId} at ${alreadySent.sentAt?.toISOString()} — skipping`,
      );
      return;
    }

    // 3. Build email content
    const subject = this.buildSubject(template, cart.customer.firstName ?? '');
    const html = this.buildEmailHtml(cart, template);

    // 4. Send via Resend
    const result = await this.resend.emails.send({
      from: this.defaultFrom,
      to: cart.customer.email,
      subject,
      html,
    });

    if ('error' in result && result.error) {
      throw new Error(`Resend error: ${result.error.message}`);
    }

    // 5. Record the sent email to prevent duplicates
    await this.prisma.abandonedCartEmail.create({
      data: {
        cartId,
        template,
        sentAt: new Date(),
        resendId: (result as any).data?.id ?? null,
      },
    });

    this.logger.log(
      `Abandoned cart email "${template}" sent to ${cart.customer.email} for cart ${cartId}`,
    );
  }

  // ─── Private helpers ────────────────────────────────────────────────────────

  private buildSubject(template: string, firstName: string): string {
    const name = firstName ? `, ${firstName}` : '';
    switch (template) {
      case 'first-reminder':
        return `${name ? firstName + ', ' : ''}olvidaste algo en tu carrito`;
      case 'second-reminder':
        return `Tu carrito te está esperando`;
      case 'final-reminder':
        return `Oferta especial: completa tu compra hoy`;
      default:
        return 'Tu carrito te está esperando';
    }
  }

  private buildEmailHtml(
    cart: {
      id: string;
      customer: { email: string; firstName?: string | null; lastName?: string | null } | null;
      items: Array<{
        quantity: number;
        priceCents: number;
        variant: {
          sku: string;
          title: string;
          product: {
            name: string;
            slug: string;
            images: Array<{ url: string; altText?: string | null }>;
          };
        };
      }>;
    },
    template: string,
  ): string {
    const firstName = cart.customer?.firstName ?? 'Cliente';
    const cartUrl = `${this.storeUrl}/carrito`;
    const storeName = this.storeName;

    const itemsHtml = cart.items
      .map((item) => {
        const imageUrl =
          item.variant.product.images[0]?.url ?? `${this.storeUrl}/placeholder.png`;
        const imageAlt =
          item.variant.product.images[0]?.altText ?? item.variant.product.name;
        const productUrl = `${this.storeUrl}/productos/${item.variant.product.slug}`;
        const priceMxn = (item.priceCents / 100).toLocaleString('es-MX', {
          style: 'currency',
          currency: 'MXN',
        });
        const totalMxn = ((item.priceCents * item.quantity) / 100).toLocaleString('es-MX', {
          style: 'currency',
          currency: 'MXN',
        });

        return `
          <tr>
            <td style="padding: 12px; border-bottom: 1px solid #eee; vertical-align: middle;">
              <img src="${imageUrl}" alt="${imageAlt}"
                style="width: 80px; height: 80px; object-fit: cover; border-radius: 4px;" />
            </td>
            <td style="padding: 12px; border-bottom: 1px solid #eee; vertical-align: middle;">
              <a href="${productUrl}" style="font-weight: 600; color: #111; text-decoration: none;">
                ${item.variant.product.name}
              </a>
              <div style="color: #666; font-size: 13px; margin-top: 4px;">
                ${item.variant.title} &middot; SKU: ${item.variant.sku}
              </div>
            </td>
            <td style="padding: 12px; border-bottom: 1px solid #eee; vertical-align: middle; text-align: center;">
              ${item.quantity}
            </td>
            <td style="padding: 12px; border-bottom: 1px solid #eee; vertical-align: middle; text-align: right;">
              ${priceMxn}
            </td>
            <td style="padding: 12px; border-bottom: 1px solid #eee; vertical-align: middle; text-align: right; font-weight: 600;">
              ${totalMxn}
            </td>
          </tr>`;
      })
      .join('');

    const discountSection =
      template === 'final-reminder'
        ? `<div style="background: #fef3cd; border: 1px solid #f0c040; border-radius: 6px; padding: 16px; margin: 24px 0; text-align: center;">
             <strong>Oferta exclusiva:</strong> usa el código
             <span style="font-size: 18px; font-weight: 700; color: #b45309; letter-spacing: 2px;">VUELVE10</span>
             en tu próxima compra y obtén 10% de descuento.
           </div>`
        : '';

    return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${storeName} — Tu carrito te espera</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f5f5f5; margin: 0; padding: 24px;">
  <div style="max-width: 600px; margin: 0 auto; background: #fff; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 4px rgba(0,0,0,0.1);">

    <!-- Header -->
    <div style="background: #111; padding: 24px; text-align: center;">
      <a href="${this.storeUrl}" style="color: #fff; font-size: 22px; font-weight: 700; text-decoration: none;">
        ${storeName}
      </a>
    </div>

    <!-- Body -->
    <div style="padding: 32px;">
      <h2 style="margin: 0 0 8px;">Hola, ${firstName}</h2>
      <p style="color: #555; margin: 0 0 24px;">
        Dejaste algunos artículos en tu carrito. ¡No te quedes sin ellos!
      </p>

      ${discountSection}

      <!-- Cart items -->
      <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
        <thead>
          <tr style="background: #f5f5f5;">
            <th style="padding: 10px 12px; text-align: left; font-size: 12px; text-transform: uppercase; color: #888;">Imagen</th>
            <th style="padding: 10px 12px; text-align: left; font-size: 12px; text-transform: uppercase; color: #888;">Producto</th>
            <th style="padding: 10px 12px; text-align: center; font-size: 12px; text-transform: uppercase; color: #888;">Qty</th>
            <th style="padding: 10px 12px; text-align: right; font-size: 12px; text-transform: uppercase; color: #888;">Precio</th>
            <th style="padding: 10px 12px; text-align: right; font-size: 12px; text-transform: uppercase; color: #888;">Total</th>
          </tr>
        </thead>
        <tbody>${itemsHtml}</tbody>
      </table>

      <!-- CTA -->
      <div style="text-align: center; margin: 32px 0 0;">
        <a href="${cartUrl}"
          style="display: inline-block; background: #111; color: #fff; padding: 14px 32px;
                 border-radius: 6px; text-decoration: none; font-weight: 600; font-size: 16px;">
          Completar mi compra
        </a>
      </div>
    </div>

    <!-- Footer -->
    <div style="padding: 24px; background: #f5f5f5; text-align: center; font-size: 12px; color: #999;">
      <p style="margin: 0;">
        Recibiste este correo porque tienes artículos en tu carrito en
        <a href="${this.storeUrl}" style="color: #666;">${storeName}</a>.
      </p>
      <p style="margin: 8px 0 0;">
        <a href="${this.storeUrl}/unsubscribe?email=${encodeURIComponent(cart.customer?.email ?? '')}" style="color: #999;">
          Cancelar suscripción
        </a>
      </p>
    </div>
  </div>
</body>
</html>`;
  }

  @OnQueueFailed()
  onFailed(job: Job<AbandonedCartJobData>, error: Error): void {
    this.logger.error(
      `Abandoned cart job ${job.id} failed after ${job.attemptsMade} attempt(s): ${error.message}`,
      error.stack,
    );
  }
}
