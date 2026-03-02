import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsInt, Min } from 'class-validator';

export class AddCartItemDto {
  @ApiProperty({ description: 'Product variant ID' })
  @IsString()
  @IsNotEmpty()
  variantId: string;

  @ApiProperty({ minimum: 1 })
  @IsInt()
  @Min(1)
  quantity: number;
}

export class UpdateCartItemDto {
  @ApiProperty({ minimum: 0, description: 'Set to 0 to remove item' })
  @IsInt()
  @Min(0)
  quantity: number;
}

export class ApplyCouponDto {
  @ApiProperty({ description: 'Coupon code' })
  @IsString()
  @IsNotEmpty()
  code: string;
}
