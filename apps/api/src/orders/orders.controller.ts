import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  Res,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { OrdersService } from './orders.service';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UserRole } from '@prisma/client';
import { PaginationDto } from '../common/dto/pagination.dto';
import {
  UpdateOrderStatusDto,
  ProcessRefundDto,
  CancelOrderDto,
  OrderFilterDto,
} from './dto/order.dto';

@ApiTags('Orders')
@ApiBearerAuth()
@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  // Admin endpoints
  @Get()
  @Roles(UserRole.MANAGER)
  @ApiOperation({ summary: 'List all orders (admin)' })
  getOrders(@Query() filters: OrderFilterDto) {
    return this.ordersService.getOrders(filters);
  }

  @Get(':id')
  @Roles(UserRole.MANAGER)
  @ApiOperation({ summary: 'Get order by ID (admin)' })
  getOrder(@Param('id') id: string) {
    return this.ordersService.getOrder(id);
  }

  @Patch(':id/status')
  @Roles(UserRole.MANAGER)
  @ApiOperation({ summary: 'Update order status (admin)' })
  updateOrderStatus(
    @Param('id') id: string,
    @Body() dto: UpdateOrderStatusDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.ordersService.updateOrderStatus(id, dto, userId);
  }

  @Post(':id/refund')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Process order refund (admin)' })
  processRefund(
    @Param('id') id: string,
    @Body() dto: ProcessRefundDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.ordersService.processRefund(id, dto, userId);
  }

  @Get(':id/pdf')
  @Roles(UserRole.MANAGER)
  @ApiOperation({ summary: 'Download packing slip PDF (admin)' })
  async getPackingSlip(@Param('id') id: string, @Res() res: Response) {
    const buffer = await this.ordersService.generatePackingSlip(id);
    res.set({
      'Content-Type': 'text/plain',
      'Content-Disposition': `attachment; filename="packing-slip-${id}.txt"`,
      'Content-Length': buffer.length,
    });
    res.end(buffer);
  }

  // Customer endpoints
  @Get('my/orders')
  @ApiOperation({ summary: 'Get my orders' })
  getMyOrders(@CurrentUser('id') userId: string, @Query() pagination: PaginationDto) {
    return this.ordersService.getMyOrders(userId, pagination);
  }

  @Get('my/:id')
  @ApiOperation({ summary: 'Get my order by ID' })
  getMyOrder(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.ordersService.getMyOrder(id, userId);
  }

  @Post(':id/cancel')
  @ApiOperation({ summary: 'Cancel my order' })
  cancelOrder(
    @Param('id') id: string,
    @Body() dto: CancelOrderDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.ordersService.cancelOrder(id, dto, userId, false);
  }
}
