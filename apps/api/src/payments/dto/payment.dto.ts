import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsEnum, IsInt, Min, IsOptional } from 'class-validator';
import { PaymentGateway, PaymentMethod } from '@prisma/client';

export class CreatePaymentIntentDto {
  @ApiProperty() @IsString() @IsNotEmpty() orderId: string;

  @ApiProperty({ enum: PaymentGateway })
  @IsEnum(PaymentGateway)
  gateway: PaymentGateway;

  @ApiProperty({ enum: PaymentMethod })
  @IsEnum(PaymentMethod)
  method: PaymentMethod;

  @ApiProperty({ description: 'Amount in cents' })
  @IsInt()
  @Min(1)
  amount: number;

  @ApiPropertyOptional({ default: 'MXN' })
  @IsOptional()
  @IsString()
  currency?: string;
}

export class ConfirmPaymentDto {
  @ApiProperty({ description: 'Gateway payment ID (e.g., Stripe PaymentIntent ID)' })
  @IsString()
  @IsNotEmpty()
  gatewayPaymentId: string;
}

export class GatewayConfigDto {
  @ApiProperty({ description: 'Encrypted or plain config JSON' })
  config: Record<string, any>;

  @ApiPropertyOptional()
  @IsOptional()
  isSandbox?: boolean;
}
