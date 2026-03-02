import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CartService } from '../cart/cart.service';
import { InventoryService } from '../inventory/inventory.service';
import { EmailService } from '../email/email.service';
import { CreateOrderDto, CalculateTotalsDto } from './dto/checkout.dto';
import { OrderStatus, PaymentStatus } from '@prisma/client';

@Injectable()
export class CheckoutService {
  private readonly logger = new Logger(CheckoutService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cartService: CartService,
    private readonly inventoryService: InventoryService,
    private readonly emailService: EmailService,
  ) {}

  async getShippingMethods(postalCode: string, country: string = 'MX') {
    const zones = await this.prisma.shippingZone.findMany({
      where: {
        OR: [
          { isDefault: true },
          { countries: { has: country } },
          { postalCodes: { has: postalCode } },
        ],
      },
      include: {
        methods: {
          where: { isActive: true },
          orderBy: { sortOrder: 'asc' },
        },
      },
    });

    const methods: any[] = [];
    for (const zone of zones) {
      methods.push(...zone.methods);
    }

    return methods.map((m) => ({
      id: m.id,
      name: m.name,
      description: m.description,
      price: m.price,
      estimatedDaysMin: m.estimatedDaysMin,
      estimatedDaysMax: m.estimatedDaysMax,
      carrier: m.carrier,
      type: m.type,
    }));
  }

  async calculateTotals(dto: CalculateTotalsDto) {
    const cart = await this.cartService.getCartSummary(dto.cartId);
    const shippingMethod = await this.prisma.shippingMethod.findUnique({
      where: { id: dto.shippingMethodId },
    });

    if (!shippingMethod) throw new NotFoundException('Shipping method not found');

    let subtotal = cart.subtotal;
    let discountAmount = 0;

    if (dto.couponCode || cart.couponCode) {
      const code = dto.couponCode || cart.couponCode;
      const promotion = await this.prisma.promotion.findUnique({ where: { code: code! } });
      if (promotion && promotion.status === 'ACTIVE') {
        discountAmount = this.calculateDiscount(promotion, subtotal);
      }
    }

    const afterDiscount = Math.max(0, subtotal - discountAmount);
    let shippingAmount = shippingMethod.price;

    if (shippingMethod.freeShippingThreshold && afterDiscount >= shippingMethod.freeShippingThreshold) {
      shippingAmount = 0;
    }

    const taxRate = 0.16;
    const taxAmount = Math.round(afterDiscount * taxRate);
    const totalAmount = afterDiscount + shippingAmount + taxAmount;

    return {
      subtotal,
      discountAmount,
      shippingAmount,
      taxAmount,
      totalAmount,
      currency: cart.currency,
      shippingMethod: {
        id: shippingMethod.id,
        name: shippingMethod.name,
        estimatedDaysMin: shippingMethod.estimatedDaysMin,
        estimatedDaysMax: shippingMethod.estimatedDaysMax,
      },
    };
  }

  async createOrder(dto: CreateOrderDto, userId?: string, ipAddress?: string, userAgent?: string) {
    const cart = await this.cartService.getCartSummary(dto.cartId);

    if (cart.items.length === 0) {
      throw new BadRequestException('Cart is empty');
    }

    const totals = await this.calculateTotals({
      cartId: dto.cartId,
      shippingMethodId: dto.shippingMethodId,
      couponCode: dto.couponCode,
    });

    const shippingMethod = await this.prisma.shippingMethod.findUnique({
      where: { id: dto.shippingMethodId },
    });
    if (!shippingMethod) throw new NotFoundException('Shipping method not found');

    const reservationIds: string[] = [];

    const order = await this.prisma.$transaction(async (tx) => {
      for (const item of cart.items) {
        const reservationId = await this.inventoryService.reserveStock(item.variantId, {
          quantity: item.quantity,
          cartId: dto.cartId,
          ttlMinutes: 60,
        });
        reservationIds.push(reservationId);
      }

      let shippingAddressId: string | undefined;
      let billingAddressId: string | undefined;

      if (userId) {
        const shippingAddr = await tx.customerAddress.create({
          data: {
            userId,
            type: 'SHIPPING',
            firstName: dto.shippingAddress.firstName,
            lastName: dto.shippingAddress.lastName,
            company: dto.shippingAddress.company,
            address1: dto.shippingAddress.address1,
            address2: dto.shippingAddress.address2,
            city: dto.shippingAddress.city,
            state: dto.shippingAddress.state,
            postalCode: dto.shippingAddress.postalCode,
            country: dto.shippingAddress.country ?? 'MX',
            phone: dto.shippingAddress.phone,
          },
        });
        shippingAddressId = shippingAddr.id;

        if (dto.billingAddress) {
          const billingAddr = await tx.customerAddress.create({
            data: {
              userId,
              type: 'BILLING',
              firstName: dto.billingAddress.firstName,
              lastName: dto.billingAddress.lastName,
              address1: dto.billingAddress.address1,
              address2: dto.billingAddress.address2,
              city: dto.billingAddress.city,
              state: dto.billingAddress.state,
              postalCode: dto.billingAddress.postalCode,
              country: dto.billingAddress.country ?? 'MX',
            },
          });
          billingAddressId = billingAddr.id;
        }
      }

      const orderNumber = await this.generateOrderNumber(tx);

      const created = await tx.order.create({
        data: {
          orderNumber,
          customerId: userId,
          email: dto.email,
          phone: dto.phone,
          status: OrderStatus.PENDING,
          paymentStatus: PaymentStatus.PENDING,
          currency: cart.currency,
          subtotal: totals.subtotal,
          discountAmount: totals.discountAmount,
          shippingAmount: totals.shippingAmount,
          taxAmount: totals.taxAmount,
          totalAmount: totals.totalAmount,
          couponCode: dto.couponCode ?? cart.couponCode,
          notes: dto.notes,
          shippingAddressId,
          billingAddressId,
          shippingMethodId: dto.shippingMethodId,
          shippingMethodName: shippingMethod.name,
          ipAddress,
          userAgent,
          lineItems: {
            create: cart.items.map((item: any) => ({
              productId: item.variant.product.id,
              variantId: item.variantId,
              sku: item.variant.sku,
              title: item.variant.product.title,
              variantTitle: item.variant.title,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              totalPrice: item.lineTotal,
              imageUrl: item.variant.product.image?.url,
              requiresShipping: true,
            })),
          },
          timeline: {
            create: {
              status: OrderStatus.PENDING,
              message: 'Order created',
            },
          },
        },
        include: {
          lineItems: true,
          timeline: true,
        },
      });

      await this.cartService.clearCart(dto.cartId);

      return created;
    });

    try {
      await this.emailService.sendOrderConfirmation(order, dto.email);
    } catch (err) {
      this.logger.error(`Failed to send order confirmation: ${(err as Error).message}`);
    }

    return order;
  }

  private calculateDiscount(promotion: any, subtotal: number): number {
    if (promotion.minimumOrderAmount && subtotal < promotion.minimumOrderAmount) {
      return 0;
    }

    let discount = 0;
    if (promotion.discountType === 'PERCENTAGE') {
      discount = Math.round(subtotal * (promotion.discountValue / 100));
    } else if (promotion.discountType === 'FIXED_AMOUNT') {
      discount = promotion.discountValue;
    }

    if (promotion.maximumDiscountAmount && discount > promotion.maximumDiscountAmount) {
      discount = promotion.maximumDiscountAmount;
    }

    return Math.min(discount, subtotal);
  }

  private async generateOrderNumber(tx: any): Promise<string> {
    const count = await tx.order.count();
    const num = String(count + 1001).padStart(6, '0');
    return `ORD-${num}`;
  }
}
