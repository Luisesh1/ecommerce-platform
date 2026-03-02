import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { buildPaginatedResponse } from '../common/dto/pagination.dto';
import {
  CreatePromotionDto,
  UpdatePromotionDto,
  ValidateCouponDto,
  PromotionFilterDto,
} from './dto/promotion.dto';
import { CouponStatus } from '@prisma/client';

@Injectable()
export class PromosService {
  private readonly logger = new Logger(PromosService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getPromotions(filters: PromotionFilterDto) {
    const { page = 1, limit = 20, status, search } = filters;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (status) where.status = status;
    if (search) {
      where.OR = [
        { code: { contains: search, mode: 'insensitive' } },
        { title: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [promos, total] = await Promise.all([
      this.prisma.promotion.findMany({ where, skip, take: limit, orderBy: { createdAt: 'desc' } }),
      this.prisma.promotion.count({ where }),
    ]);

    return buildPaginatedResponse(promos, total, page, limit);
  }

  async getPromotion(id: string) {
    const promo = await this.prisma.promotion.findUnique({
      where: { id },
      include: { usages: { take: 10, orderBy: { usedAt: 'desc' } } },
    });
    if (!promo) throw new NotFoundException(`Promotion ${id} not found`);
    return promo;
  }

  async createPromotion(dto: CreatePromotionDto) {
    const existing = await this.prisma.promotion.findUnique({ where: { code: dto.code } });
    if (existing) throw new ConflictException(`Coupon code "${dto.code}" already exists`);

    const promo = await this.prisma.promotion.create({
      data: {
        code: dto.code.toUpperCase(),
        title: dto.title,
        description: dto.description,
        discountType: dto.discountType,
        discountValue: dto.discountValue,
        minimumOrderAmount: dto.minimumOrderAmount,
        maximumDiscountAmount: dto.maximumDiscountAmount,
        usageLimit: dto.usageLimit,
        usageLimitPerCustomer: dto.usageLimitPerCustomer,
        isCombinable: dto.isCombinable ?? false,
        freeShipping: dto.freeShipping ?? false,
        startDate: dto.startDate ? new Date(dto.startDate) : undefined,
        endDate: dto.endDate ? new Date(dto.endDate) : undefined,
        status: dto.status ?? CouponStatus.ACTIVE,
        applicableProductIds: dto.applicableProductIds ?? [],
        applicableCategoryIds: dto.applicableCategoryIds ?? [],
        excludedProductIds: dto.excludedProductIds ?? [],
        buyQuantity: dto.buyQuantity,
        getQuantity: dto.getQuantity,
        getProductId: dto.getProductId,
      },
    });

    this.logger.log(`Created promotion: ${promo.id} (${promo.code})`);
    return promo;
  }

  async updatePromotion(id: string, dto: UpdatePromotionDto) {
    await this.getPromotion(id);

    if (dto.code) {
      const existing = await this.prisma.promotion.findUnique({ where: { code: dto.code.toUpperCase() } });
      if (existing && existing.id !== id) {
        throw new ConflictException(`Coupon code "${dto.code}" already exists`);
      }
    }

    const updated = await this.prisma.promotion.update({
      where: { id },
      data: {
        ...(dto.code !== undefined && { code: dto.code.toUpperCase() }),
        ...(dto.title !== undefined && { title: dto.title }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.discountType !== undefined && { discountType: dto.discountType }),
        ...(dto.discountValue !== undefined && { discountValue: dto.discountValue }),
        ...(dto.minimumOrderAmount !== undefined && { minimumOrderAmount: dto.minimumOrderAmount }),
        ...(dto.maximumDiscountAmount !== undefined && { maximumDiscountAmount: dto.maximumDiscountAmount }),
        ...(dto.usageLimit !== undefined && { usageLimit: dto.usageLimit }),
        ...(dto.usageLimitPerCustomer !== undefined && { usageLimitPerCustomer: dto.usageLimitPerCustomer }),
        ...(dto.isCombinable !== undefined && { isCombinable: dto.isCombinable }),
        ...(dto.freeShipping !== undefined && { freeShipping: dto.freeShipping }),
        ...(dto.startDate !== undefined && { startDate: dto.startDate ? new Date(dto.startDate) : null }),
        ...(dto.endDate !== undefined && { endDate: dto.endDate ? new Date(dto.endDate) : null }),
        ...(dto.status !== undefined && { status: dto.status }),
        ...(dto.applicableProductIds !== undefined && { applicableProductIds: dto.applicableProductIds }),
        ...(dto.applicableCategoryIds !== undefined && { applicableCategoryIds: dto.applicableCategoryIds }),
        ...(dto.excludedProductIds !== undefined && { excludedProductIds: dto.excludedProductIds }),
      },
    });

    return updated;
  }

  async deletePromotion(id: string): Promise<void> {
    await this.getPromotion(id);
    await this.prisma.promotion.delete({ where: { id } });
    this.logger.log(`Deleted promotion: ${id}`);
  }

  async validateCoupon(dto: ValidateCouponDto) {
    const code = dto.code.toUpperCase();
    const promotion = await this.prisma.promotion.findUnique({ where: { code } });

    if (!promotion) {
      return { valid: false, error: 'Coupon code not found' };
    }

    if (promotion.status !== CouponStatus.ACTIVE) {
      return { valid: false, error: 'Coupon is not active' };
    }

    const now = new Date();
    if (promotion.startDate && promotion.startDate > now) {
      return { valid: false, error: 'Coupon is not yet valid' };
    }
    if (promotion.endDate && promotion.endDate < now) {
      return { valid: false, error: 'Coupon has expired' };
    }

    if (promotion.usageLimit && promotion.usageCount >= promotion.usageLimit) {
      return { valid: false, error: 'Coupon usage limit reached' };
    }

    if (dto.cartTotal !== undefined && promotion.minimumOrderAmount) {
      if (dto.cartTotal < promotion.minimumOrderAmount) {
        return {
          valid: false,
          error: `Minimum order amount is $${promotion.minimumOrderAmount / 100}`,
        };
      }
    }

    if (dto.customerId && promotion.usageLimitPerCustomer) {
      const customerUsage = await this.prisma.promotionUsage.count({
        where: { promotionId: promotion.id, customerId: dto.customerId },
      });
      if (customerUsage >= promotion.usageLimitPerCustomer) {
        return { valid: false, error: 'You have already used this coupon' };
      }
    }

    let discountAmount = 0;
    const cartTotal = dto.cartTotal ?? 0;
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
      valid: true,
      promotion: {
        id: promotion.id,
        code: promotion.code,
        title: promotion.title,
        discountType: promotion.discountType,
        discountValue: promotion.discountValue,
        freeShipping: promotion.freeShipping,
      },
      discountAmount,
    };
  }

  async applyCoupon(
    code: string,
    orderId: string,
    customerId: string | null,
    email: string,
    cartTotal: number,
  ) {
    const validation = await this.validateCoupon({ code, cartTotal, customerId: customerId ?? undefined });
    if (!validation.valid) throw new BadRequestException(validation.error);

    const promotion = await this.prisma.promotion.findUnique({ where: { code: code.toUpperCase() } });
    if (!promotion) throw new NotFoundException('Promotion not found');

    await this.prisma.promotionUsage.upsert({
      where: { promotionId_orderId: { promotionId: promotion.id, orderId } },
      create: {
        promotionId: promotion.id,
        orderId,
        customerId,
        email,
        discountAmount: validation.discountAmount ?? 0,
      },
      update: {},
    });

    await this.prisma.promotion.update({
      where: { id: promotion.id },
      data: { usageCount: { increment: 1 } },
    });

    return validation;
  }
}
