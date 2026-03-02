import {
  IsString,
  IsNumber,
  IsOptional,
  IsEnum,
  IsBoolean,
  IsEmail,
  IsIP,
  MaxLength,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum BlacklistType {
  IP = 'IP',
  EMAIL = 'EMAIL',
}

export class CheckOrderDto {
  @ApiProperty()
  @IsString()
  orderId: string;

  @ApiProperty()
  @IsString()
  userId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  ip?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  amount: number;
}

export class AddBlacklistDto {
  @ApiProperty({ enum: BlacklistType })
  @IsEnum(BlacklistType)
  type: BlacklistType;

  @ApiProperty({ description: 'IP address or email to blacklist' })
  @IsString()
  @MaxLength(255)
  value: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class UpdateFraudRuleDto {
  @ApiProperty()
  @IsBoolean()
  enabled: boolean;
}
