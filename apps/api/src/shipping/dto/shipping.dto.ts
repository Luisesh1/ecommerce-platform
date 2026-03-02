import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsArray,
  IsOptional,
  IsBoolean,
  IsEnum,
  IsNumber,
  IsObject,
  Min,
} from 'class-validator';

export enum ShippingMethodType {
  FLAT_RATE = 'FLAT_RATE',
  FREE = 'FREE',
  WEIGHT_BASED = 'WEIGHT_BASED',
  ORDER_VALUE_BASED = 'ORDER_VALUE_BASED',
}

export class CreateShippingZoneDto {
  @ApiProperty({ description: 'Zone display name' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({ description: 'ISO-2 country codes covered by this zone', type: [String] })
  @IsArray()
  @IsString({ each: true })
  countries!: string[];

  @ApiPropertyOptional({ description: 'Mark this zone as the default fallback' })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}

export class UpdateShippingZoneDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  countries?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}

export class CreateShippingMethodDto {
  @ApiProperty({ description: 'Method display name' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({ enum: ShippingMethodType })
  @IsEnum(ShippingMethodType)
  type!: ShippingMethodType;

  @ApiPropertyOptional({ description: 'Base price in cents' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  price?: number;

  @ApiPropertyOptional({
    description:
      'Conditions JSON: e.g. { minWeight, maxWeight } for WEIGHT_BASED; { minOrderValue } for FREE/ORDER_VALUE_BASED',
  })
  @IsOptional()
  @IsObject()
  conditions?: Record<string, unknown>;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}

export class UpdateShippingMethodDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ enum: ShippingMethodType })
  @IsOptional()
  @IsEnum(ShippingMethodType)
  type?: ShippingMethodType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  price?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  conditions?: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}

export interface ShippingZone {
  id: string;
  name: string;
  countries: string[];
  isDefault: boolean;
}

export interface ShippingMethod {
  id: string;
  zoneId: string;
  name: string;
  type: ShippingMethodType;
  price: number;
  conditions: Record<string, unknown>;
  enabled: boolean;
}
