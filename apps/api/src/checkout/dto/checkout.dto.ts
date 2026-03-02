import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsEmail,
  IsOptional,
  ValidateNested,
  IsEnum,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PaymentGateway, PaymentMethod } from '@prisma/client';

export class ShippingAddressDto {
  @ApiProperty() @IsString() @IsNotEmpty() firstName: string;
  @ApiProperty() @IsString() @IsNotEmpty() lastName: string;
  @ApiPropertyOptional() @IsOptional() @IsString() company?: string;
  @ApiProperty() @IsString() @IsNotEmpty() address1: string;
  @ApiPropertyOptional() @IsOptional() @IsString() address2?: string;
  @ApiProperty() @IsString() @IsNotEmpty() city: string;
  @ApiProperty() @IsString() @IsNotEmpty() state: string;
  @ApiProperty() @IsString() @IsNotEmpty() postalCode: string;
  @ApiPropertyOptional({ default: 'MX' }) @IsOptional() @IsString() country?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() phone?: string;
}

export class CreateOrderDto {
  @ApiProperty() @IsString() @IsNotEmpty() cartId: string;
  @ApiProperty() @IsEmail() email: string;
  @ApiPropertyOptional() @IsOptional() @IsString() phone?: string;

  @ApiProperty({ type: ShippingAddressDto })
  @ValidateNested()
  @Type(() => ShippingAddressDto)
  shippingAddress: ShippingAddressDto;

  @ApiPropertyOptional({ type: ShippingAddressDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => ShippingAddressDto)
  billingAddress?: ShippingAddressDto;

  @ApiProperty() @IsString() @IsNotEmpty() shippingMethodId: string;

  @ApiProperty({ enum: PaymentGateway })
  @IsEnum(PaymentGateway)
  paymentGateway: PaymentGateway;

  @ApiProperty({ enum: PaymentMethod })
  @IsEnum(PaymentMethod)
  paymentMethod: PaymentMethod;

  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() couponCode?: string;
}

export class CalculateTotalsDto {
  @ApiProperty() @IsString() @IsNotEmpty() cartId: string;
  @ApiProperty() @IsString() @IsNotEmpty() shippingMethodId: string;
  @ApiPropertyOptional() @IsOptional() @IsString() couponCode?: string;
}
