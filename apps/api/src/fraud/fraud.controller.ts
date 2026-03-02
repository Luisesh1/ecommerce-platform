import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { FraudService } from './fraud.service';
import { AddBlacklistDto, UpdateFraudRuleDto, CheckOrderDto } from './dto/fraud.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import { IsOptional, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

class FraudEventsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number = 50;
}

@ApiTags('Fraud')
@ApiBearerAuth('access-token')
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
@Controller('admin/fraud')
export class FraudController {
  constructor(private readonly fraudService: FraudService) {}

  // ─── RULES ──────────────────────────────────────────────────────────────

  @Get('rules')
  @ApiOperation({ summary: 'List fraud detection rules' })
  async getRules() {
    return this.fraudService.getRules();
  }

  @Patch('rules/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Enable or disable a fraud rule' })
  async updateRule(
    @Param('id') id: string,
    @Body() dto: UpdateFraudRuleDto,
  ) {
    return this.fraudService.updateRule(id, dto.enabled);
  }

  // ─── BLACKLIST ───────────────────────────────────────────────────────────

  @Get('blacklist')
  @ApiOperation({ summary: 'List blacklisted IPs and emails' })
  async getBlacklist() {
    return this.fraudService.getBlacklist();
  }

  @Post('blacklist')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Add an IP or email to the blacklist' })
  async addToBlacklist(@Body() dto: AddBlacklistDto) {
    return this.fraudService.addToBlacklist(dto);
  }

  @Delete('blacklist/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove an entry from the blacklist' })
  async removeFromBlacklist(@Param('id') id: string) {
    await this.fraudService.removeFromBlacklist(id);
  }

  // ─── EVENTS ──────────────────────────────────────────────────────────────

  @Get('events')
  @ApiOperation({ summary: 'List recent fraud events' })
  @ApiQuery({ name: 'limit', required: false })
  async getEvents(@Query() query: FraudEventsQueryDto) {
    return this.fraudService.getRecentEvents(query.limit);
  }

  // ─── CHECK (internal / testing use) ─────────────────────────────────────

  @Post('check')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Run a fraud check on an order (admin / internal)' })
  async checkOrder(@Body() dto: CheckOrderDto) {
    return this.fraudService.checkOrder(
      dto.orderId,
      dto.userId,
      dto.ip,
      dto.email,
      dto.amount,
    );
  }
}
