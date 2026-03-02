import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsEnum,
  IsOptional,
  IsInt,
  IsBoolean,
  IsArray,
  IsDateString,
  Min,
} from 'class-validator';
import { DiscountType, CouponStatus } from '@prisma/client';
import { PaginationDto } from '../../common/dto/pagination.dto';

export class CreatePromotionDto {
  @ApiProperty({ description: 'Unique coupon code' })
  @IsString()
  @IsNotEmpty()
  code: string;

  @ApiProperty() @IsString() @IsNotEmpty() title: string;
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;

  @ApiProperty({ enum: DiscountType })
  @IsEnum(DiscountType)
  discountType: DiscountType;

  @ApiProperty({ description: 'Discount value (percentage or cents)' })
  @IsInt()
  @Min(0)
  discountValue: number;

  @ApiPropertyOptional({ description: 'Minimum order amount in cents' })
  @IsOptional() @IsInt() @Min(0) minimumOrderAmount?: number;

  @ApiPropertyOptional({ description: 'Maximum discount amount in cents' })
  @IsOptional() @IsInt() @Min(0) maximumDiscountAmount?: number;

  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(1) usageLimit?: number;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(1) usageLimitPerCustomer?: number;

  @ApiPropertyOptional({ default: false }) @IsOptional() @IsBoolean() isCombinable?: boolean;
  @ApiPropertyOptional({ default: false }) @IsOptional() @IsBoolean() freeShipping?: boolean;

  @ApiPropertyOptional() @IsOptional() @IsDateString() startDate?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() endDate?: string;

  @ApiPropertyOptional({ enum: CouponStatus }) @IsOptional() @IsEnum(CouponStatus) status?: CouponStatus;

  @ApiPropertyOptional({ type: [String] }) @IsOptional() @IsArray() @IsString({ each: true }) applicableProductIds?: string[];
  @ApiPropertyOptional({ type: [String] }) @IsOptional() @IsArray() @IsString({ each: true }) applicableCategoryIds?: string[];
  @ApiPropertyOptional({ type: [String] }) @IsOptional() @IsArray() @IsString({ each: true }) excludedProductIds?: string[];

  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(1) buyQuantity?: number;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(1) getQuantity?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() getProductId?: string;
}

export class UpdatePromotionDto extends CreatePromotionDto {}

export class ValidateCouponDto {
  @ApiProperty() @IsString() @IsNotEmpty() code: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) cartTotal?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() customerId?: string;
  @ApiPropertyOptional({ type: [String] }) @IsOptional() @IsArray() @IsString({ each: true }) productIds?: string[];
}

export class PromotionFilterDto extends PaginationDto {
  @ApiPropertyOptional({ enum: CouponStatus }) @IsOptional() @IsEnum(CouponStatus) status?: CouponStatus;
  @ApiPropertyOptional() @IsOptional() @IsString() search?: string;
}
