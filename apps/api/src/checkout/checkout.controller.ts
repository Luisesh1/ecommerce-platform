import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { Request } from 'express';
import { CheckoutService } from './checkout.service';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CreateOrderDto, CalculateTotalsDto } from './dto/checkout.dto';

@ApiTags('Checkout')
@Controller('checkout')
export class CheckoutController {
  constructor(private readonly checkoutService: CheckoutService) {}

  @Public()
  @Get('shipping-methods')
  @ApiOperation({ summary: 'Get available shipping methods' })
  @ApiQuery({ name: 'postalCode', required: true })
  @ApiQuery({ name: 'country', required: false })
  getShippingMethods(
    @Query('postalCode') postalCode: string,
    @Query('country') country?: string,
  ) {
    return this.checkoutService.getShippingMethods(postalCode, country);
  }

  @Public()
  @Post('calculate')
  @ApiOperation({ summary: 'Calculate order totals' })
  calculateTotals(@Body() dto: CalculateTotalsDto) {
    return this.checkoutService.calculateTotals(dto);
  }

  @Post('create-order')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create order from cart' })
  createOrder(
    @Body() dto: CreateOrderDto,
    @CurrentUser('id') userId: string,
    @Req() req: Request,
  ) {
    const ipAddress = req.ip;
    const userAgent = req.headers['user-agent'];
    return this.checkoutService.createOrder(dto, userId, ipAddress, userAgent);
  }
}
