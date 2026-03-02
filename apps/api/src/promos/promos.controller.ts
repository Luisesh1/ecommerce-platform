import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { PromosService } from './promos.service';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import {
  CreatePromotionDto,
  UpdatePromotionDto,
  ValidateCouponDto,
  PromotionFilterDto,
} from './dto/promotion.dto';

@ApiTags('Promotions')
@Controller('promos')
export class PromosController {
  constructor(private readonly promosService: PromosService) {}

  @Get()
  @ApiBearerAuth()
  @Roles(UserRole.MANAGER)
  @ApiOperation({ summary: 'List all promotions (admin)' })
  getPromotions(@Query() filters: PromotionFilterDto) {
    return this.promosService.getPromotions(filters);
  }

  @Get(':id')
  @ApiBearerAuth()
  @Roles(UserRole.MANAGER)
  @ApiOperation({ summary: 'Get promotion by ID (admin)' })
  getPromotion(@Param('id') id: string) {
    return this.promosService.getPromotion(id);
  }

  @Post()
  @ApiBearerAuth()
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Create promotion (admin)' })
  createPromotion(@Body() dto: CreatePromotionDto) {
    return this.promosService.createPromotion(dto);
  }

  @Patch(':id')
  @ApiBearerAuth()
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Update promotion (admin)' })
  updatePromotion(@Param('id') id: string, @Body() dto: UpdatePromotionDto) {
    return this.promosService.updatePromotion(id, dto);
  }

  @Delete(':id')
  @ApiBearerAuth()
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete promotion (admin)' })
  deletePromotion(@Param('id') id: string) {
    return this.promosService.deletePromotion(id);
  }

  @Public()
  @Post('validate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Validate a coupon code' })
  validateCoupon(@Body() dto: ValidateCouponDto) {
    return this.promosService.validateCoupon(dto);
  }
}
