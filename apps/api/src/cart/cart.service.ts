import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AddCartItemDto, UpdateCartItemDto } from './dto/add-cart-item.dto';

@Injectable()
export class CartService {
  private readonly logger = new Logger(CartService.name);

  private readonly cartInclude = {
    items: {
      include: {
        variant: {
          include: {
            product: {
              include: {
                images: { take: 1, orderBy: { sortOrder: 'asc' as const } },
              },
            },
            inventoryLevel: true,
          },
        },
      },
    },
  };

  constructor(private readonly prisma: PrismaService) {}

  async getCart(sessionId?: string, userId?: string) {
    if (!sessionId && !userId) {
      throw new BadRequestException('Either sessionId or userId is required');
    }

    const where: any = {};
    if (userId) where.customerId = userId;
    else if (sessionId) where.sessionId = sessionId;

    let cart = await this.prisma.cart.findFirst({
      where,
      include: this.cartInclude,
    });

    if (!cart) {
      cart = await this.prisma.cart.create({
        data: {
          customerId: userId,
          sessionId: userId ? undefined : sessionId,
        },
        include: this.cartInclude,
      });
    }

    return this.buildCartSummary(cart);
  }

  async getCartById(cartId: string) {
    const cart = await this.prisma.cart.findUnique({
      where: { id: cartId },
      include: this.cartInclude,
    });
    if (!cart) throw new NotFoundException('Cart not found');
    return cart;
  }

  async addItem(cartId: string, dto: AddCartItemDto) {
    const cart = await this.getCartById(cartId);

    const variant = await this.prisma.productVariant.findUnique({
      where: { id: dto.variantId, isActive: true },
      include: { inventoryLevel: true, product: true },
    });

    if (!variant) throw new NotFoundException('Product variant not found');
    if (variant.product.status !== 'ACTIVE') {
      throw new BadRequestException('Product is not available');
    }

    const available = (variant.inventoryLevel?.quantity ?? 0) - (variant.inventoryLevel?.reservedQuantity ?? 0);
    if (variant.inventoryPolicy === 'DENY' && available < dto.quantity) {
      throw new BadRequestException(`Insufficient stock. Available: ${available}`);
    }

    const existingItem = await this.prisma.cartItem.findUnique({
      where: { cartId_variantId: { cartId, variantId: dto.variantId } },
    });

    if (existingItem) {
      await this.prisma.cartItem.update({
        where: { id: existingItem.id },
        data: { quantity: existingItem.quantity + dto.quantity },
      });
    } else {
      await this.prisma.cartItem.create({
        data: { cartId, variantId: dto.variantId, quantity: dto.quantity },
      });
    }

    return this.getCartSummary(cartId);
  }

  async updateItem(cartId: string, itemId: string, dto: UpdateCartItemDto) {
    const item = await this.prisma.cartItem.findUnique({ where: { id: itemId } });
    if (!item || item.cartId !== cartId) throw new NotFoundException('Cart item not found');

    if (dto.quantity === 0) {
      await this.prisma.cartItem.delete({ where: { id: itemId } });
    } else {
      await this.prisma.cartItem.update({
        where: { id: itemId },
        data: { quantity: dto.quantity },
      });
    }

    return this.getCartSummary(cartId);
  }

  async removeItem(cartId: string, itemId: string) {
    const item = await this.prisma.cartItem.findUnique({ where: { id: itemId } });
    if (!item || item.cartId !== cartId) throw new NotFoundException('Cart item not found');

    await this.prisma.cartItem.delete({ where: { id: itemId } });
    return this.getCartSummary(cartId);
  }

  async clearCart(cartId: string): Promise<void> {
    await this.prisma.cartItem.deleteMany({ where: { cartId } });
    await this.prisma.cart.update({
      where: { id: cartId },
      data: { couponCode: null, promotionId: null },
    });
  }

  async mergeCart(guestCartId: string, userCartId: string) {
    const guestCart = await this.prisma.cart.findUnique({
      where: { id: guestCartId },
      include: { items: true },
    });
    if (!guestCart) return;

    for (const item of guestCart.items) {
      const existing = await this.prisma.cartItem.findUnique({
        where: { cartId_variantId: { cartId: userCartId, variantId: item.variantId } },
      });

      if (existing) {
        await this.prisma.cartItem.update({
          where: { id: existing.id },
          data: { quantity: Math.max(existing.quantity, item.quantity) },
        });
      } else {
        await this.prisma.cartItem.create({
          data: { cartId: userCartId, variantId: item.variantId, quantity: item.quantity },
        });
      }
    }

    await this.prisma.cart.delete({ where: { id: guestCartId } });
    return this.getCartSummary(userCartId);
  }

  async applyCoupon(cartId: string, code: string) {
    const promotion = await this.prisma.promotion.findUnique({ where: { code } });
    if (!promotion) throw new NotFoundException('Coupon code not found');
    if (promotion.status !== 'ACTIVE') throw new BadRequestException('Coupon is not active');

    const now = new Date();
    if (promotion.startDate && promotion.startDate > now) {
      throw new BadRequestException('Coupon is not yet valid');
    }
    if (promotion.endDate && promotion.endDate < now) {
      throw new BadRequestException('Coupon has expired');
    }
    if (promotion.usageLimit && promotion.usageCount >= promotion.usageLimit) {
      throw new BadRequestException('Coupon usage limit reached');
    }

    await this.prisma.cart.update({
      where: { id: cartId },
      data: { couponCode: code, promotionId: promotion.id },
    });

    return this.getCartSummary(cartId);
  }

  async removeCoupon(cartId: string) {
    await this.prisma.cart.update({
      where: { id: cartId },
      data: { couponCode: null, promotionId: null },
    });
    return this.getCartSummary(cartId);
  }

  async getCartSummary(cartId: string) {
    const cart = await this.prisma.cart.findUnique({
      where: { id: cartId },
      include: this.cartInclude,
    });
    if (!cart) throw new NotFoundException('Cart not found');
    return this.buildCartSummary(cart);
  }

  private buildCartSummary(cart: any) {
    let subtotal = 0;
    let discountAmount = 0;

    const items = cart.items.map((item: any) => {
      const price = item.variant.price;
      const lineTotal = price * item.quantity;
      subtotal += lineTotal;
      return {
        id: item.id,
        variantId: item.variantId,
        quantity: item.quantity,
        unitPrice: price,
        lineTotal,
        variant: {
          sku: item.variant.sku,
          title: item.variant.title,
          options: item.variant.options,
          compareAtPrice: item.variant.compareAtPrice,
          product: {
            id: item.variant.product.id,
            title: item.variant.product.title,
            slug: item.variant.product.slug,
            image: item.variant.product.images?.[0] ?? null,
          },
          availableQuantity:
            (item.variant.inventoryLevel?.quantity ?? 0) -
            (item.variant.inventoryLevel?.reservedQuantity ?? 0),
        },
      };
    });

    if (cart.promotionId) {
      this.applyPromoDiscount(cart, subtotal, (d) => {
        discountAmount = d;
      });
    }

    const shippingEstimate = subtotal > 50000 ? 0 : 9900;

    return {
      id: cart.id,
      sessionId: cart.sessionId,
      customerId: cart.customerId,
      couponCode: cart.couponCode,
      currency: cart.currency,
      items,
      itemCount: items.length,
      totalQuantity: items.reduce((sum: number, i: any) => sum + i.quantity, 0),
      subtotal,
      discountAmount,
      shippingEstimate,
      taxEstimate: Math.round((subtotal - discountAmount) * 0.16),
      total: subtotal - discountAmount + shippingEstimate,
      updatedAt: cart.updatedAt,
    };
  }

  private applyPromoDiscount(
    cart: any,
    subtotal: number,
    setDiscount: (d: number) => void,
  ): void {
    // Discount will be calculated properly in checkout
    setDiscount(0);
  }
}
