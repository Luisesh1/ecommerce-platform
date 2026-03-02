import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { Request } from 'express';
import { CartService } from './cart.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { AddCartItemDto, UpdateCartItemDto, ApplyCouponDto } from './dto/add-cart-item.dto';

@ApiTags('Cart')
@Controller('cart')
export class CartController {
  constructor(private readonly cartService: CartService) {}

  @Get()
  @Public()
  @ApiOperation({ summary: 'Get or create cart' })
  @ApiQuery({ name: 'sessionId', required: false })
  getCart(
    @Query('sessionId') sessionId?: string,
    @CurrentUser('id') userId?: string,
  ) {
    return this.cartService.getCart(sessionId, userId);
  }

  @Post('items')
  @Public()
  @ApiOperation({ summary: 'Add item to cart' })
  @ApiQuery({ name: 'cartId', required: true })
  addItem(
    @Query('cartId') cartId: string,
    @Body() dto: AddCartItemDto,
  ) {
    return this.cartService.addItem(cartId, dto);
  }

  @Patch('items/:id')
  @Public()
  @ApiOperation({ summary: 'Update cart item quantity' })
  @ApiQuery({ name: 'cartId', required: true })
  updateItem(
    @Query('cartId') cartId: string,
    @Param('id') itemId: string,
    @Body() dto: UpdateCartItemDto,
  ) {
    return this.cartService.updateItem(cartId, itemId, dto);
  }

  @Delete('items/:id')
  @Public()
  @ApiOperation({ summary: 'Remove item from cart' })
  @ApiQuery({ name: 'cartId', required: true })
  removeItem(
    @Query('cartId') cartId: string,
    @Param('id') itemId: string,
  ) {
    return this.cartService.removeItem(cartId, itemId);
  }

  @Delete()
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Clear entire cart' })
  @ApiQuery({ name: 'cartId', required: true })
  clearCart(@Query('cartId') cartId: string) {
    return this.cartService.clearCart(cartId);
  }

  @Post('merge')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Merge guest cart into user cart on login' })
  mergeCart(
    @Body() body: { guestCartId: string },
    @CurrentUser('id') userId: string,
  ) {
    return this.cartService.getCart(undefined, userId).then((userCart) =>
      this.cartService.mergeCart(body.guestCartId, userCart.id),
    );
  }

  @Post('coupon')
  @Public()
  @ApiOperation({ summary: 'Apply coupon to cart' })
  @ApiQuery({ name: 'cartId', required: true })
  applyCoupon(
    @Query('cartId') cartId: string,
    @Body() dto: ApplyCouponDto,
  ) {
    return this.cartService.applyCoupon(cartId, dto.code);
  }

  @Delete('coupon')
  @Public()
  @ApiOperation({ summary: 'Remove coupon from cart' })
  @ApiQuery({ name: 'cartId', required: true })
  removeCoupon(@Query('cartId') cartId: string) {
    return this.cartService.removeCoupon(cartId);
  }
}
