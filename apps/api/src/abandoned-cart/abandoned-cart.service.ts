import { Injectable, Logger, Inject } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import IORedis from 'ioredis';
import { PrismaService } from '../prisma/prisma.service';
import { REDIS_CLIENT } from '../redis/redis.module';

const ABANDONED_THRESHOLD_MS = 2 * 60 * 60 * 1000; // 2 hours
const EMAIL_SENT_DEDUP_KEY = (cartId: string) => `abandoned-cart:email-sent:${cartId}`;

@Injectable()
export class AbandonedCartService {
  private readonly logger = new Logger(AbandonedCartService.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue('abandoned-carts') private readonly abandonedCartsQueue: Queue,
    @Inject(REDIS_CLIENT) private readonly redis: IORedis,
  ) {}

  /**
   * Called by a cron job / scheduler.
   * Finds carts that:
   *   - Were last updated more than 2 hours ago.
   *   - Have at least one item.
   *   - Have no associated completed order.
   *   - Have not yet had a recovery email sent.
   * For each eligible cart, enqueues a BullMQ job with a 5-minute delay.
   */
  async checkAndEnqueue(): Promise<{ enqueued: number; skipped: number }> {
    const threshold = new Date(Date.now() - ABANDONED_THRESHOLD_MS);

    // Find carts updated before threshold with items and an associated user email
    const carts = await (this.prisma as any).cart.findMany({
      where: {
        updatedAt: { lt: threshold },
        items: { some: {} }, // has at least one item
        order: null,         // no order created from this cart
        user: {
          email: { not: null },
        },
      },
      include: {
        items: {
          include: { product: true },
        },
        user: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
      },
      take: 200, // process in batches
    });

    let enqueued = 0;
    let skipped = 0;

    for (const cart of carts) {
      try {
        // Check if email was already sent (Redis dedup key or DB record)
        const alreadySent = await this.hasEmailBeenSent(cart.id);
        if (alreadySent) {
          skipped++;
          continue;
        }

        await this.abandonedCartsQueue.add(
          'send-recovery-email',
          {
            cartId: cart.id,
            userId: cart.userId,
            userEmail: cart.user?.email,
            userName: cart.user ? `${cart.user.firstName ?? ''} ${cart.user.lastName ?? ''}`.trim() : '',
            items: cart.items.map((item: any) => ({
              productId: item.productId,
              productName: item.product?.name ?? 'Product',
              quantity: item.quantity,
              price: item.price,
            })),
            cartTotal: cart.items.reduce(
              (sum: number, item: any) => sum + item.price * item.quantity,
              0,
            ),
          },
          {
            delay: 5 * 60 * 1000, // 5 minutes
            attempts: 3,
            backoff: { type: 'exponential', delay: 3000 },
            removeOnComplete: 50,
            removeOnFail: 100,
          },
        );

        // Mark as queued in Redis immediately to avoid re-enqueue on next cron run
        await this.redis.set(EMAIL_SENT_DEDUP_KEY(cart.id), 'queued', 'EX', 7 * 24 * 3600);

        enqueued++;
        this.logger.log(`Enqueued abandoned cart recovery for cart ${cart.id}`);
      } catch (err) {
        this.logger.error(
          `Failed to enqueue abandoned cart ${cart.id}: ${(err as Error).message}`,
        );
        skipped++;
      }
    }

    return { enqueued, skipped };
  }

  /**
   * Called by the worker after successfully sending the recovery email.
   * Persists the record in the AbandonedCartEmail table and updates Redis.
   */
  async markEmailSent(cartId: string): Promise<void> {
    // Upsert the AbandonedCartEmail record
    try {
      await (this.prisma as any).abandonedCartEmail.upsert({
        where: { cartId },
        create: {
          cartId,
          sentAt: new Date(),
          status: 'SENT',
        },
        update: {
          sentAt: new Date(),
          status: 'SENT',
        },
      });
    } catch (err) {
      // If the model doesn't exist yet, fall back to Redis only
      this.logger.warn(
        `AbandonedCartEmail model not found, using Redis only: ${(err as Error).message}`,
      );
    }

    // Ensure Redis flag is set (may already be set from checkAndEnqueue)
    await this.redis.set(EMAIL_SENT_DEDUP_KEY(cartId), 'sent', 'EX', 7 * 24 * 3600);
    this.logger.log(`Marked abandoned cart email sent for cart ${cartId}`);
  }

  /**
   * Checks Redis + DB to determine if the recovery email was already sent.
   */
  private async hasEmailBeenSent(cartId: string): Promise<boolean> {
    // Fast path: Redis
    const redisFlag = await this.redis.get(EMAIL_SENT_DEDUP_KEY(cartId));
    if (redisFlag) return true;

    // Slow path: DB
    try {
      const record = await (this.prisma as any).abandonedCartEmail.findUnique({
        where: { cartId },
      });
      if (record) {
        // Warm up Redis cache
        await this.redis.set(EMAIL_SENT_DEDUP_KEY(cartId), 'sent', 'EX', 7 * 24 * 3600);
        return true;
      }
    } catch {
      // Model may not exist — continue
    }

    return false;
  }
}
