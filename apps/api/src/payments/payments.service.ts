import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePaymentIntentDto, ConfirmPaymentDto } from './dto/payment.dto';
import { PaymentGateway, PaymentStatus } from '@prisma/client';
import * as crypto from 'crypto';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);
  private readonly encryptionKey: string;
  private readonly algorithm = 'aes-256-gcm';

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    this.encryptionKey = this.configService.get<string>(
      'ENCRYPTION_KEY',
      '0000000000000000000000000000000000000000000000000000000000000000',
    );
  }

  async createPaymentIntent(dtoOrOrderId: CreatePaymentIntentDto | string, gateway?: any, options?: any) {
    const dto: CreatePaymentIntentDto = typeof dtoOrOrderId === 'string'
      ? { orderId: dtoOrOrderId, gateway, ...(options ?? {}) } as CreatePaymentIntentDto
      : dtoOrOrderId;
    const order = await this.prisma.order.findUnique({ where: { id: dto.orderId } });
    if (!order) throw new NotFoundException('Order not found');

    const config = await this.getGatewayConfig(dto.gateway);
    if (!config || !config.isEnabled) {
      throw new BadRequestException(`Payment gateway ${dto.gateway} is not configured or enabled`);
    }

    let gatewayPaymentId: string | undefined;
    let clientSecret: string | undefined;

    try {
      if (dto.gateway === PaymentGateway.STRIPE) {
        const result = await this.createStripeIntent(
          dto.amount,
          dto.currency ?? 'mxn',
          config,
        );
        gatewayPaymentId = result.id;
        clientSecret = result.client_secret;
      } else if (dto.gateway === PaymentGateway.MERCADOPAGO) {
        const result = await this.createMercadoPagoPreference(dto.amount, order, config);
        gatewayPaymentId = result.id;
      } else if (dto.gateway === PaymentGateway.PAYPAL) {
        const result = await this.createPayPalOrder(dto.amount, dto.currency ?? 'MXN', config);
        gatewayPaymentId = result.id;
      }
    } catch (err) {
      this.logger.error(`Failed to create payment intent: ${(err as Error).message}`);
      throw new BadRequestException(`Payment gateway error: ${(err as Error).message}`);
    }

    const payment = await this.prisma.payment.create({
      data: {
        orderId: dto.orderId,
        gateway: dto.gateway,
        method: dto.method,
        status: PaymentStatus.PENDING,
        amount: dto.amount,
        currency: dto.currency ?? 'MXN',
        gatewayPaymentId,
        clientSecret,
      },
    });

    return {
      paymentId: payment.id,
      gatewayPaymentId,
      clientSecret,
      amount: dto.amount,
      currency: payment.currency,
      gateway: dto.gateway,
    };
  }

  async confirmPayment(paymentId: string, dto: ConfirmPaymentDto) {
    const payment = await this.prisma.payment.findUnique({ where: { id: paymentId } });
    if (!payment) throw new NotFoundException('Payment not found');

    await this.prisma.payment.update({
      where: { id: paymentId },
      data: {
        status: PaymentStatus.CAPTURED,
        gatewayPaymentId: dto.gatewayPaymentId,
      },
    });

    await this.prisma.order.update({
      where: { id: payment.orderId },
      data: { paymentStatus: PaymentStatus.PAID },
    });

    return { success: true, paymentId };
  }

  async refundPayment(paymentId: string, amount: number, reason: string) {
    const payment = await this.prisma.payment.findUnique({ where: { id: paymentId } });
    if (!payment) throw new NotFoundException('Payment not found');
    if (!payment.gatewayPaymentId) throw new BadRequestException('Payment has no gateway ID');

    const config = await this.getGatewayConfig(payment.gateway);

    try {
      if (payment.gateway === PaymentGateway.STRIPE) {
        await this.createStripeRefund(payment.gatewayPaymentId, amount, config);
      }
    } catch (err) {
      throw new BadRequestException(`Refund failed: ${(err as Error).message}`);
    }

    const refundedAmount = payment.refundedAmount + amount;
    const newStatus =
      refundedAmount >= payment.amount
        ? PaymentStatus.FULLY_REFUNDED
        : PaymentStatus.PARTIALLY_REFUNDED;

    await this.prisma.payment.update({
      where: { id: paymentId },
      data: { refundedAmount, status: newStatus },
    });

    return { success: true, refundedAmount };
  }

  async getGatewayConfig(gateway: PaymentGateway) {
    const config = await this.prisma.paymentGatewayConfig.findUnique({ where: { gateway } });
    if (!config) return null;

    let decryptedCreds: Record<string, any> = {};
    if (config.encryptedCreds) {
      try {
        decryptedCreds = this.decrypt(config.encryptedCreds);
      } catch (err) {
        this.logger.error(`Failed to decrypt credentials for ${gateway}`);
      }
    }

    return {
      ...config,
      credentials: decryptedCreds,
      encryptedCreds: undefined,
    };
  }

  async getGatewayConfigs() {
    const configs = await this.prisma.paymentGatewayConfig.findMany({
      orderBy: { sortOrder: 'asc' },
    });

    return configs.map((c) => ({
      gateway: c.gateway,
      isEnabled: c.isEnabled,
      isSandbox: c.isSandbox,
      displayName: c.displayName,
      iconUrl: c.iconUrl,
      supportedMethods: c.supportedMethods,
      sortOrder: c.sortOrder,
      hasCredentials: !!c.encryptedCreds,
    }));
  }

  async updateGatewayConfig(
    gateway: PaymentGateway,
    credentials: Record<string, any>,
    isSandbox?: boolean,
    displayName?: string,
    isEnabled?: boolean,
  ) {
    const encryptedCreds = this.encrypt(credentials);

    await this.prisma.paymentGatewayConfig.upsert({
      where: { gateway },
      create: {
        gateway,
        encryptedCreds,
        isSandbox: isSandbox ?? true,
        displayName: displayName ?? gateway,
        isEnabled: isEnabled ?? false,
      },
      update: {
        encryptedCreds,
        ...(isSandbox !== undefined && { isSandbox }),
        ...(displayName !== undefined && { displayName }),
        ...(isEnabled !== undefined && { isEnabled }),
      },
    });

    return { success: true };
  }

  async testGatewayConnection(gateway: PaymentGateway): Promise<{ success: boolean; message: string }> {
    const config = await this.getGatewayConfig(gateway);
    if (!config) return { success: false, message: 'Gateway not configured' };

    try {
      if (gateway === PaymentGateway.STRIPE) {
        const Stripe = require('stripe');
        const stripe = new Stripe(config.credentials.secretKey);
        await stripe.accounts.retrieve();
      }
      return { success: true, message: 'Connection successful' };
    } catch (err) {
      return { success: false, message: (err as Error).message };
    }
  }

  private encrypt(data: Record<string, any>): string {
    const iv = crypto.randomBytes(16);
    const key = Buffer.from(this.encryptionKey, 'hex');
    const cipher = crypto.createCipheriv(this.algorithm, key, iv);

    const json = JSON.stringify(data);
    const encrypted = Buffer.concat([cipher.update(json, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();

    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
  }

  private decrypt(encryptedData: string): Record<string, any> {
    const [ivHex, authTagHex, encryptedHex] = encryptedData.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const encrypted = Buffer.from(encryptedHex, 'hex');
    const key = Buffer.from(this.encryptionKey, 'hex');

    const decipher = crypto.createDecipheriv(this.algorithm, key, iv);
    decipher.setAuthTag(authTag);

    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    return JSON.parse(decrypted.toString('utf8'));
  }

  private async createStripeIntent(
    amount: number,
    currency: string,
    config: any,
  ): Promise<any> {
    const Stripe = require('stripe');
    const stripe = new Stripe(config.credentials.secretKey);
    return stripe.paymentIntents.create({ amount, currency, automatic_payment_methods: { enabled: true } });
  }

  private async createStripeRefund(
    paymentIntentId: string,
    amount: number,
    config: any,
  ): Promise<any> {
    const Stripe = require('stripe');
    const stripe = new Stripe(config.credentials.secretKey);
    return stripe.refunds.create({ payment_intent: paymentIntentId, amount });
  }

  private async createMercadoPagoPreference(
    amount: number,
    order: any,
    config: any,
  ): Promise<any> {
    const { MercadoPagoConfig, Preference } = require('mercadopago');
    const mpConfig = new MercadoPagoConfig({ accessToken: config.credentials.accessToken });
    const preference = new Preference(mpConfig);
    return preference.create({
      body: {
        items: [{ title: `Order ${order.orderNumber}`, quantity: 1, unit_price: amount / 100 }],
        external_reference: order.id,
      },
    });
  }

  private async createPayPalOrder(
    amount: number,
    currency: string,
    config: any,
  ): Promise<any> {
    const { default: checkoutSdk } = require('@paypal/checkout-server-sdk');
    const env = config.isSandbox
      ? new checkoutSdk.core.SandboxEnvironment(config.credentials.clientId, config.credentials.clientSecret)
      : new checkoutSdk.core.LiveEnvironment(config.credentials.clientId, config.credentials.clientSecret);
    const client = new checkoutSdk.core.PayPalHttpClient(env);
    const request = new checkoutSdk.orders.OrdersCreateRequest();
    request.requestBody({
      intent: 'CAPTURE',
      purchase_units: [{ amount: { currency_code: currency, value: (amount / 100).toFixed(2) } }],
    });
    const response = await client.execute(request);
    return response.result;
  }

  // Alias for listGatewayConfigs
  async listGatewayConfigs() {
    return this.getGatewayConfigs();
  }
}
