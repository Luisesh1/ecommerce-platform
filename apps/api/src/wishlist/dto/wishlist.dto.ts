import { IsString, IsOptional, IsEmail, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AddWishlistItemDto {
  @ApiProperty({ description: 'Product ID to add to the wishlist' })
  @IsUUID()
  productId: string;

  @ApiPropertyOptional({ description: 'Optional specific variant ID' })
  @IsOptional()
  @IsUUID()
  variantId?: string;
}

export class BackInStockSubscribeDto {
  @ApiProperty({ description: 'Product ID to subscribe to' })
  @IsUUID()
  productId: string;

  @ApiPropertyOptional({ description: 'Specific variant ID (optional)' })
  @IsOptional()
  @IsUUID()
  variantId?: string;

  @ApiPropertyOptional({ description: 'Email address for notification (defaults to logged-in user email)' })
  @IsOptional()
  @IsEmail()
  email?: string;
}
