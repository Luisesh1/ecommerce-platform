import { Process, Processor, OnQueueFailed } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { PrismaService } from '../prisma.service';

export interface InventoryExpiryJobData {
  /** Optional: only process reservations for a specific variant */
  variantId?: string;
  /** Optional: only process reservations for a specific cart */
  cartId?: string;
}

@Processor('inventory')
export class InventoryExpiryProcessor {
  private readonly logger = new Logger(InventoryExpiryProcessor.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Release expired inventory reservations.
   * Called on a schedule (e.g., every 5 minutes) or triggered explicitly.
   */
  @Process('release-expired-reservations')
  async handleReleaseExpiredReservations(job: Job<InventoryExpiryJobData>): Promise<void> {
    const now = new Date();
    this.logger.log(`Running inventory expiry check at ${now.toISOString()}`);

    const where: Record<string, any> = {
      expiresAt: { lt: now },
      releasedAt: null,
    };

    if (job.data?.variantId) where.variantId = job.data.variantId;
    if (job.data?.cartId) where.cartId = job.data.cartId;

    // Fetch all expired, unreleased reservations
    const expired = await this.prisma.inventoryReservation.findMany({
      where,
      include: { variant: true },
      take: 500, // Process in batches to avoid long-running transactions
    });

    if (expired.length === 0) {
      this.logger.debug('No expired reservations found');
      return;
    }

    this.logger.log(`Found ${expired.length} expired reservation(s) to release`);

    let released = 0;
    let failed = 0;

    for (const reservation of expired) {
      try {
        await this.releaseReservation(reservation);
        released++;
      } catch (err) {
        failed++;
        this.logger.error(
          `Failed to release reservation ${reservation.id}: ${(err as Error).message}`,
          (err as Error).stack,
        );
      }
    }

    this.logger.log(
      `Inventory expiry complete: ${released} released, ${failed} failed`,
    );

    if (failed > 0) {
      throw new Error(`${failed} reservation(s) failed to release — see logs above`);
    }
  }

  /**
   * Release a specific reservation by ID (e.g., when a cart is abandoned or
   * an order is cancelled).
   */
  @Process('release-reservation')
  async handleReleaseReservation(
    job: Job<{ reservationId: string; reason?: string }>,
  ): Promise<void> {
    const { reservationId, reason } = job.data;

    const reservation = await this.prisma.inventoryReservation.findUnique({
      where: { id: reservationId },
      include: { variant: true },
    });

    if (!reservation) {
      this.logger.warn(`Reservation ${reservationId} not found`);
      return;
    }

    if (reservation.releasedAt) {
      this.logger.debug(`Reservation ${reservationId} already released`);
      return;
    }

    await this.releaseReservation(reservation, reason);
    this.logger.log(`Reservation ${reservationId} released: ${reason ?? 'manual'}`);
  }

  // ─── Private helpers ────────────────────────────────────────────────────────

  private async releaseReservation(
    reservation: {
      id: string;
      variantId: string;
      quantity: number;
      orderId: string | null;
      cartId: string | null;
      variant: { id: string; reservedQuantity: number };
    },
    reason = 'expiry',
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      // 1. Mark the reservation as released
      await tx.inventoryReservation.update({
        where: { id: reservation.id },
        data: { releasedAt: new Date() },
      });

      // 2. Decrement reservedQuantity and restore available stock on the variant
      await tx.productVariant.update({
        where: { id: reservation.variantId },
        data: {
          reservedQuantity: {
            decrement: reservation.quantity,
          },
          // availableQuantity = stockQuantity - reservedQuantity is a computed
          // value in most schemas; if stored explicitly, increment it here.
          // availableQuantity: { increment: reservation.quantity },
        },
      });

      // 3. Create an inventory movement record for audit trail
      await tx.inventoryMovement.create({
        data: {
          variantId: reservation.variantId,
          type: 'RESERVATION_RELEASE',
          quantity: reservation.quantity,
          reason: `Reservation ${reservation.id} released (${reason})`,
          referenceId: reservation.orderId ?? reservation.cartId ?? reservation.id,
          referenceType: reservation.orderId
            ? 'ORDER'
            : reservation.cartId
              ? 'CART'
              : 'RESERVATION',
        },
      });
    });
  }

  @OnQueueFailed()
  onFailed(job: Job<InventoryExpiryJobData>, error: Error): void {
    this.logger.error(
      `Inventory job ${job.id} failed after ${job.attemptsMade} attempt(s): ${error.message}`,
      error.stack,
    );
  }
}
