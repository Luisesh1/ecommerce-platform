import { DiscountType, CouponStatus } from '../enums';

export interface Promotion {
  id: string;
  code: string;
  title: string;
  description?: string;
  discountType: DiscountType;
  discountValue: number;
  minimumOrderAmount?: number;
  maximumDiscountAmount?: number;
  usageLimit?: number;
  usageCount: number;
  usageLimitPerCustomer?: number;
  isCombinable: boolean;
  startDate?: Date;
  endDate?: Date;
  status: CouponStatus;
  applicableProductIds?: string[];
  applicableCategoryIds?: string[];
  excludedProductIds?: string[];
  freeShipping: boolean;
  buyQuantity?: number;
  getQuantity?: number;
  getProductId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface PromotionValidation {
  isValid: boolean;
  discount?: number;
  freeShipping?: boolean;
  message?: string;
  promotionId?: string;
  code?: string;
}

export interface PromotionUsage {
  id: string;
  promotionId: string;
  orderId: string;
  customerId?: string;
  email: string;
  discountAmount: number;
  usedAt: Date;
}
