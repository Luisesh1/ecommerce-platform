import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { WishlistService } from './wishlist.service';
import { AddWishlistItemDto, BackInStockSubscribeDto } from './dto/wishlist.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';

interface AuthUser {
  id: string;
  email: string;
}

@ApiTags('Wishlist')
@ApiBearerAuth('access-token')
@Controller('wishlist')
export class WishlistController {
  constructor(private readonly wishlistService: WishlistService) {}

  // ─── WISHLIST ──────────────────────────────────────────────────────────

  @Get()
  @ApiOperation({ summary: "Get the authenticated user's wishlist" })
  async getWishlist(@CurrentUser() user: AuthUser) {
    return this.wishlistService.getWishlist(user.id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Add a product to the wishlist' })
  async addItem(
    @CurrentUser() user: AuthUser,
    @Body() dto: AddWishlistItemDto,
  ) {
    return this.wishlistService.addItem(user.id, dto);
  }

  @Delete(':productId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove a product from the wishlist' })
  async removeItem(
    @CurrentUser() user: AuthUser,
    @Param('productId') productId: string,
  ) {
    await this.wishlistService.removeItem(user.id, productId);
  }

  // ─── BACK-IN-STOCK ─────────────────────────────────────────────────────

  @Get('back-in-stock')
  @ApiOperation({ summary: 'List back-in-stock subscriptions for the current user' })
  async getBackInStockSubscriptions(@CurrentUser() user: AuthUser) {
    return this.wishlistService.getBackInStockSubscriptions(user.id);
  }

  @Post('back-in-stock')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Subscribe to back-in-stock notifications for a product' })
  async subscribe(
    @CurrentUser() user: AuthUser,
    @Body() dto: BackInStockSubscribeDto,
  ) {
    return this.wishlistService.subscribeBackInStock(user.id, user.email, dto);
  }

  @Delete('back-in-stock/:productId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Unsubscribe from back-in-stock notifications' })
  async unsubscribe(
    @CurrentUser() user: AuthUser,
    @Param('productId') productId: string,
  ) {
    await this.wishlistService.unsubscribeBackInStock(user.id, user.email, productId);
  }
}
