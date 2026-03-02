import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { InventoryService } from './inventory.service';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UserRole } from '@prisma/client';
import { PaginationDto } from '../common/dto/pagination.dto';
import { AdjustStockDto } from './dto/adjust-stock.dto';
import { ReserveStockDto } from './dto/reserve-stock.dto';

@ApiTags('Inventory')
@ApiBearerAuth()
@Controller('inventory')
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get()
  @Roles(UserRole.MANAGER)
  @ApiOperation({ summary: 'Get all inventory levels (admin)' })
  getAllInventory(@Query() pagination: PaginationDto) {
    return this.inventoryService.getAllInventory(pagination);
  }

  @Get('low-stock')
  @Roles(UserRole.MANAGER)
  @ApiOperation({ summary: 'Get low stock items (admin)' })
  @ApiQuery({ name: 'threshold', required: false, type: Number })
  getLowStockItems(@Query('threshold') threshold?: string) {
    return this.inventoryService.getLowStockItems(threshold ? parseInt(threshold) : 10);
  }

  @Get(':variantId')
  @Roles(UserRole.MANAGER)
  @ApiOperation({ summary: 'Get inventory level for a variant (admin)' })
  getInventoryLevel(@Param('variantId') variantId: string) {
    return this.inventoryService.getInventoryLevel(variantId);
  }

  @Get(':variantId/movements')
  @Roles(UserRole.MANAGER)
  @ApiOperation({ summary: 'Get inventory movements for a variant (admin)' })
  getMovements(@Param('variantId') variantId: string, @Query() pagination: PaginationDto) {
    return this.inventoryService.getMovements(variantId, pagination);
  }

  @Post(':variantId/adjust')
  @Roles(UserRole.MANAGER)
  @ApiOperation({ summary: 'Adjust stock for a variant (admin)' })
  adjustStock(
    @Param('variantId') variantId: string,
    @Body() dto: AdjustStockDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.inventoryService.adjustStock(variantId, dto, userId);
  }

  @Post(':variantId/reserve')
  @Roles(UserRole.MANAGER)
  @ApiOperation({ summary: 'Reserve stock (admin/internal)' })
  reserveStock(@Param('variantId') variantId: string, @Body() dto: ReserveStockDto) {
    return this.inventoryService.reserveStock(variantId, dto);
  }
}
