import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { IsString, IsNumber, IsEnum, IsOptional, IsBoolean, Min, Max } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TaxService, TaxMethod } from './tax.service';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

class CreateTaxRateDto {
  @ApiProperty({ description: 'Region code: ISO-2 country, ISO region (MX-CMX), or * for global' })
  @IsString()
  region!: string;

  @ApiProperty({ description: 'Tax percentage (e.g. 16 for 16%)' })
  @IsNumber()
  @Min(0)
  @Max(100)
  rate!: number;

  @ApiProperty({ enum: ['INCLUSIVE', 'EXCLUSIVE'] })
  @IsEnum(['INCLUSIVE', 'EXCLUSIVE'])
  method!: TaxMethod;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}

class UpdateTaxRateDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  region?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  rate?: number;

  @ApiPropertyOptional({ enum: ['INCLUSIVE', 'EXCLUSIVE'] })
  @IsOptional()
  @IsEnum(['INCLUSIVE', 'EXCLUSIVE'])
  method?: TaxMethod;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}

@ApiTags('Admin - Tax')
@ApiBearerAuth()
@Roles(UserRole.ADMIN)
@Controller('api/admin/tax')
export class TaxController {
  constructor(private readonly taxService: TaxService) {}

  @ApiOperation({ summary: 'List all tax rates' })
  @Get()
  listRates() {
    return this.taxService.listRates();
  }

  @ApiOperation({ summary: 'Create a tax rate' })
  @HttpCode(HttpStatus.CREATED)
  @Post()
  createRate(@Body() dto: CreateTaxRateDto) {
    return this.taxService.createRate(dto);
  }

  @ApiOperation({ summary: 'Update a tax rate' })
  @Patch(':id')
  updateRate(@Param('id') id: string, @Body() dto: UpdateTaxRateDto) {
    return this.taxService.updateRate(id, dto);
  }

  @ApiOperation({ summary: 'Delete a tax rate' })
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete(':id')
  deleteRate(@Param('id') id: string) {
    return this.taxService.deleteRate(id);
  }
}
