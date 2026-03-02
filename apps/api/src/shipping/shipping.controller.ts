import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { ShippingService } from './shipping.service';
import {
  CreateShippingZoneDto,
  UpdateShippingZoneDto,
  CreateShippingMethodDto,
  UpdateShippingMethodDto,
} from './dto/shipping.dto';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@ApiTags('Shipping')
@Controller()
export class ShippingController {
  constructor(private readonly shippingService: ShippingService) {}

  // ── Public ──────────────────────────────────────────────────────────────────

  @ApiOperation({ summary: 'Estimate shipping cost (public)' })
  @ApiQuery({ name: 'cp', required: false, description: 'Postal code' })
  @ApiQuery({ name: 'country', required: false, description: 'ISO-2 country code' })
  @ApiQuery({ name: 'productId', required: false })
  @ApiQuery({ name: 'orderValue', required: false, description: 'Order value in cents' })
  @ApiQuery({ name: 'weightGrams', required: false, description: 'Total weight in grams' })
  @Public()
  @Get('api/shipping/estimate')
  async estimate(
    @Query('cp') cp?: string,
    @Query('country') country?: string,
    @Query('productId') productId?: string,
    @Query('orderValue') orderValue?: string,
    @Query('weightGrams') weightGrams?: string,
  ) {
    return this.shippingService.estimateShipping({
      cp,
      country,
      productId,
      orderValue: orderValue ? parseFloat(orderValue) : undefined,
      weightGrams: weightGrams ? parseFloat(weightGrams) : undefined,
    });
  }

  // ── Admin: Zones ────────────────────────────────────────────────────────────

  @ApiOperation({ summary: 'List all shipping zones' })
  @ApiBearerAuth()
  @Roles(UserRole.ADMIN)
  @Get('api/admin/shipping/zones')
  listZones() {
    return this.shippingService.listZones();
  }

  @ApiOperation({ summary: 'Create a shipping zone' })
  @ApiBearerAuth()
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  @Post('api/admin/shipping/zones')
  createZone(@Body() dto: CreateShippingZoneDto) {
    return this.shippingService.createZone(dto);
  }

  @ApiOperation({ summary: 'Update a shipping zone' })
  @ApiBearerAuth()
  @Roles(UserRole.ADMIN)
  @Patch('api/admin/shipping/zones/:id')
  updateZone(@Param('id') id: string, @Body() dto: UpdateShippingZoneDto) {
    return this.shippingService.updateZone(id, dto);
  }

  @ApiOperation({ summary: 'Delete a shipping zone' })
  @ApiBearerAuth()
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete('api/admin/shipping/zones/:id')
  deleteZone(@Param('id') id: string) {
    return this.shippingService.deleteZone(id);
  }

  // ── Admin: Methods ───────────────────────────────────────────────────────────

  @ApiOperation({ summary: 'List methods for a zone' })
  @ApiBearerAuth()
  @Roles(UserRole.ADMIN)
  @Get('api/admin/shipping/zones/:zoneId/methods')
  listMethods(@Param('zoneId') zoneId: string) {
    return this.shippingService.listMethods(zoneId);
  }

  @ApiOperation({ summary: 'Create a shipping method in a zone' })
  @ApiBearerAuth()
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  @Post('api/admin/shipping/zones/:zoneId/methods')
  createMethod(@Param('zoneId') zoneId: string, @Body() dto: CreateShippingMethodDto) {
    return this.shippingService.createMethod(zoneId, dto);
  }

  @ApiOperation({ summary: 'Update a shipping method' })
  @ApiBearerAuth()
  @Roles(UserRole.ADMIN)
  @Patch('api/admin/shipping/methods/:id')
  updateMethod(@Param('id') id: string, @Body() dto: UpdateShippingMethodDto) {
    return this.shippingService.updateMethod(id, dto);
  }

  @ApiOperation({ summary: 'Delete a shipping method' })
  @ApiBearerAuth()
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete('api/admin/shipping/methods/:id')
  deleteMethod(@Param('id') id: string) {
    return this.shippingService.deleteMethod(id);
  }
}
