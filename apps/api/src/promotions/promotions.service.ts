import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CouponStatus } from '@prisma/client';

@Injectable()
export class PromotionsService {
  constructor(private readonly prisma: PrismaService) {}

  async validateCoupon(code: string, cartTotal: number, _email: string) {
    const promotion = await this.prisma.promotion.findFirst({
      where: { code: code.toUpperCase() },
    });

    if (!promotion) throw new NotFoundException(`Coupon "${code}" not found`);

    if (promotion.status !== CouponStatus.ACTIVE) {
      throw new BadRequestException('Coupon is not active');
    }

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

    if (promotion.minimumOrderAmount && cartTotal < promotion.minimumOrderAmount) {
      throw new BadRequestException(
        `Minimum order amount is ${promotion.minimumOrderAmount / 100}`,
      );
    }

    return promotion;
  }

  async applyCoupon(
    code: string,
    orderId: string,
    email: string,
    cartTotal: number,
    customerId?: string,
  ): Promise<void> {
    const promotion = await this.prisma.promotion.findFirst({
      where: { code: code.toUpperCase() },
    });
    if (!promotion) throw new NotFoundException(`Coupon "${code}" not found`);

    let discountAmount = 0;
    if (promotion.discountType === 'PERCENTAGE') {
      discountAmount = Math.round(cartTotal * (promotion.discountValue / 100));
    } else if (promotion.discountType === 'FIXED_AMOUNT') {
      discountAmount = promotion.discountValue;
    }
    if (promotion.maximumDiscountAmount && discountAmount > promotion.maximumDiscountAmount) {
      discountAmount = promotion.maximumDiscountAmount;
    }
    discountAmount = Math.min(discountAmount, cartTotal);

    await this.prisma.promotionUsage.create({
      data: {
        promotionId: promotion.id,
        orderId,
        customerId: customerId ?? null,
        email,
        discountAmount,
      },
    });

    const newCount = promotion.usageCount + 1;
    const reachedLimit = promotion.usageLimit && newCount >= promotion.usageLimit;

    await this.prisma.promotion.update({
      where: { id: promotion.id },
      data: {
        usageCount: { increment: 1 },
        ...(reachedLimit ? { status: 'DEPLETED' as CouponStatus } : {}),
      },
    });
  }

  async calculateDiscount(
    code: string,
    cartTotal: number,
  ): Promise<{ discountAmount: number; freeShipping: boolean }> {
    const promotion = await this.prisma.promotion.findFirst({
      where: { code: code.toUpperCase() },
    });
    if (!promotion) throw new NotFoundException(`Coupon "${code}" not found`);

    let discountAmount = 0;

    if (promotion.discountType === 'PERCENTAGE') {
      discountAmount = Math.round(cartTotal * (promotion.discountValue / 100));
    } else if (promotion.discountType === 'FIXED_AMOUNT') {
      discountAmount = promotion.discountValue;
    }

    if (promotion.maximumDiscountAmount && discountAmount > promotion.maximumDiscountAmount) {
      discountAmount = promotion.maximumDiscountAmount;
    }

    discountAmount = Math.min(discountAmount, cartTotal);

    return {
      discountAmount,
      freeShipping: promotion.freeShipping,
    };
  }

  async listPromotions() {
    return this.prisma.promotion.findMany({ orderBy: { createdAt: 'desc' } });
  }

  async createPromotion(dto: any) {
    return this.prisma.promotion.create({ data: dto });
  }
}
