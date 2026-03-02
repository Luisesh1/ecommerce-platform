import {
  Injectable,
  Logger,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AddWishlistItemDto, BackInStockSubscribeDto } from './dto/wishlist.dto';

@Injectable()
export class WishlistService {
  private readonly logger = new Logger(WishlistService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ─── HELPERS ──────────────────────────────────────────────────────────

  /**
   * Finds or creates a Wishlist record for the given user.
   */
  private async getOrCreateWishlist(userId: string) {
    let wishlist = await this.prisma.wishlist.findFirst({
      where: { customerId: userId },
    });

    if (!wishlist) {
      wishlist = await this.prisma.wishlist.create({
        data: { customerId: userId },
      });
    }

    return wishlist;
  }

  // ─── WISHLIST ITEMS ────────────────────────────────────────────────────

  async getWishlist(userId: string) {
    const wishlist = await this.prisma.wishlist.findFirst({
      where: { customerId: userId },
      include: {
        items: {
          include: {
            product: {
              select: {
                id: true,
                title: true,
                slug: true,
                status: true,
                images: {
                  orderBy: { sortOrder: 'asc' },
                  take: 1,
                  select: { url: true, altText: true },
                },
                variants: {
                  where: { isActive: true },
                  select: {
                    id: true,
                    title: true,
                    price: true,
                    compareAtPrice: true,
                    inventoryLevel: { select: { quantity: true } },
                  },
                  orderBy: { position: 'asc' },
                },
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!wishlist) {
      return { id: null, items: [], customerId: userId };
    }

    return wishlist;
  }

  async addItem(userId: string, dto: AddWishlistItemDto) {
    // Validate product exists
    const product = await this.prisma.product.findUnique({
      where: { id: dto.productId },
    });
    if (!product) {
      throw new NotFoundException(`Product ${dto.productId} not found`);
    }

    const wishlist = await this.getOrCreateWishlist(userId);

    // Check if already exists
    const existing = await this.prisma.wishlistItem.findUnique({
      where: {
        wishlistId_productId: {
          wishlistId: wishlist.id,
          productId: dto.productId,
        },
      },
    });

    if (existing) {
      throw new ConflictException('Product is already in wishlist');
    }

    const item = await this.prisma.wishlistItem.create({
      data: {
        wishlistId: wishlist.id,
        productId: dto.productId,
        variantId: dto.variantId ?? null,
      },
      include: {
        product: {
          select: {
            id: true,
            title: true,
            slug: true,
            status: true,
          },
        },
      },
    });

    this.logger.log(`User ${userId} added product ${dto.productId} to wishlist`);
    return item;
  }

  async removeItem(userId: string, productId: string) {
    const wishlist = await this.prisma.wishlist.findFirst({
      where: { customerId: userId },
    });

    if (!wishlist) {
      throw new NotFoundException('Wishlist not found');
    }

    const item = await this.prisma.wishlistItem.findUnique({
      where: {
        wishlistId_productId: {
          wishlistId: wishlist.id,
          productId,
        },
      },
    });

    if (!item) {
      throw new NotFoundException('Item not found in wishlist');
    }

    await this.prisma.wishlistItem.delete({
      where: { id: item.id },
    });

    this.logger.log(`User ${userId} removed product ${productId} from wishlist`);
  }

  // ─── BACK-IN-STOCK SUBSCRIPTIONS ────────────────────────────────────────

  async subscribeBackInStock(
    userId: string,
    userEmail: string,
    dto: BackInStockSubscribeDto,
  ) {
    const product = await this.prisma.product.findUnique({
      where: { id: dto.productId },
    });
    if (!product) {
      throw new NotFoundException(`Product ${dto.productId} not found`);
    }

    const email = dto.email ?? userEmail;

    const existing = await this.prisma.backInStockSubscription.findUnique({
      where: {
        productId_email: {
          productId: dto.productId,
          email,
        },
      },
    });

    if (existing) {
      if (existing.isActive) {
        throw new ConflictException('Already subscribed to back-in-stock notification for this product');
      }
      // Re-activate
      return this.prisma.backInStockSubscription.update({
        where: { id: existing.id },
        data: { isActive: true, notifiedAt: null },
      });
    }

    const subscription = await this.prisma.backInStockSubscription.create({
      data: {
        productId: dto.productId,
        variantId: dto.variantId ?? null,
        email,
        customerId: userId,
        isActive: true,
      },
    });

    this.logger.log(`User ${userId} subscribed to back-in-stock for product ${dto.productId}`);
    return subscription;
  }

  async unsubscribeBackInStock(userId: string, userEmail: string, productId: string) {
    const subscription = await this.prisma.backInStockSubscription.findFirst({
      where: {
        productId,
        OR: [{ customerId: userId }, { email: userEmail }],
        isActive: true,
      },
    });

    if (!subscription) {
      throw new NotFoundException('Back-in-stock subscription not found');
    }

    await this.prisma.backInStockSubscription.update({
      where: { id: subscription.id },
      data: { isActive: false },
    });

    this.logger.log(`User ${userId} unsubscribed from back-in-stock for product ${productId}`);
  }

  async getBackInStockSubscriptions(userId: string) {
    return this.prisma.backInStockSubscription.findMany({
      where: { customerId: userId, isActive: true },
      include: {
        product: {
          select: {
            id: true,
            title: true,
            slug: true,
            images: {
              orderBy: { sortOrder: 'asc' },
              take: 1,
              select: { url: true, altText: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
