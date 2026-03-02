import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsInt, Min, IsOptional } from 'class-validator';

export class ReserveStockDto {
  @ApiProperty({ description: 'Quantity to reserve' })
  @IsInt()
  @Min(1)
  quantity: number;

  @ApiPropertyOptional({ description: 'Cart ID for this reservation' })
  @IsOptional()
  @IsString()
  cartId?: string;

  @ApiPropertyOptional({ description: 'TTL in minutes', default: 15 })
  @IsOptional()
  @IsInt()
  @Min(1)
  ttlMinutes?: number;
}
