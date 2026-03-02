import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { PrismaService } from '../prisma/prisma.service';
import { buildPaginatedResponse, PaginationDto } from '../common/dto/pagination.dto';
import { AdjustStockDto } from './dto/adjust-stock.dto';
import { ReserveStockDto } from './dto/reserve-stock.dto';
import { InventoryMovementType } from '@prisma/client';

@Injectable()
export class InventoryService {
  private readonly logger = new Logger(InventoryService.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue('inventory') private readonly inventoryQueue: Queue,
  ) {}

  async getInventoryLevel(variantId: string) {
    const level = await this.prisma.inventoryLevel.findUnique({
      where: { variantId },
      include: { variant: { select: { sku: true, title: true, productId: true } } },
    });

    if (!level) throw new NotFoundException(`Inventory level for variant ${variantId} not found`);
    return {
      ...level,
      availableQuantity: level.quantity - level.reservedQuantity,
    };
  }

  async adjustStock(variantId: string, dtoOrQty: AdjustStockDto | number, reasonOrUserId?: string, userId?: string) {
    const dto: AdjustStockDto = typeof dtoOrQty === 'number'
      ? { quantity: dtoOrQty, reason: reasonOrUserId ?? '' }
      : dtoOrQty;
    const resolvedUserId = typeof dtoOrQty === 'number' ? userId : reasonOrUserId;
    const level = await this.prisma.inventoryLevel.findUnique({ where: { variantId } });
    if (!level) {
      throw new NotFoundException(`Inventory level for variant ${variantId} not found`);
    }

    const newQuantity = level.quantity + dto.quantity;
    if (newQuantity < 0) {
      throw new BadRequestException(`Cannot reduce stock below 0. Current: ${level.quantity}, Requested: ${dto.quantity}`);
    }

    const type =
      dto.quantity > 0 ? InventoryMovementType.ADJUSTMENT : InventoryMovementType.ADJUSTMENT;

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.inventoryLevel.update({
        where: { variantId },
        data: { quantity: newQuantity },
      });

      await tx.inventoryMovement.create({
        data: {
          variantId,
          type,
          quantity: dto.quantity,
          previousQuantity: level.quantity,
          newQuantity,
          reason: dto.reason,
          referenceId: dto.referenceId,
          referenceType: dto.referenceType,
          createdBy: resolvedUserId,
        },
      });

      return updated;
    });
  }

  async reserveStock(variantId: string, dtoOrQuantity: ReserveStockDto | number, cartIdArg?: string): Promise<any> {
    const dto: ReserveStockDto = typeof dtoOrQuantity === 'number'
      ? { quantity: dtoOrQuantity, cartId: cartIdArg }
      : dtoOrQuantity;
    const level = await this.prisma.inventoryLevel.findUnique({ where: { variantId } });
    if (!level) throw new NotFoundException(`Variant ${variantId} not found`);

    const available = level.quantity - level.reservedQuantity;
    if (available < dto.quantity) {
      throw new BadRequestException(
        `Insufficient stock. Available: ${available}, Requested: ${dto.quantity}`,
      );
    }

    const ttlMinutes = dto.ttlMinutes ?? 15;
    const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000);

    const reservation = await this.prisma.$transaction(async (tx) => {
      const created = await tx.inventoryReservation.create({
        data: {
          variantId,
          cartId: dto.cartId,
          quantity: dto.quantity,
          expiresAt,
        },
      });

      await tx.inventoryLevel.update({
        where: { variantId },
        data: { reservedQuantity: { increment: dto.quantity } },
      });

      await tx.inventoryMovement.create({
        data: {
          variantId,
          type: InventoryMovementType.RESERVATION,
          quantity: -dto.quantity,
          previousQuantity: level.quantity,
          newQuantity: level.quantity,
          reason: `Reserved for cart ${dto.cartId}`,
          referenceId: created.id,
          referenceType: 'InventoryReservation',
        },
      });

      return created;
    });

    const job = await this.inventoryQueue.add(
      'expire-reservation',
      { reservationId: reservation.id },
      { delay: ttlMinutes * 60 * 1000, jobId: `expire-${reservation.id}` },
    );

    await this.prisma.inventoryReservation.update({
      where: { id: reservation.id },
      data: { jobId: String(job.id) },
    });

    return reservation;
  }

  async releaseReservation(reservationId: string): Promise<void> {
    const reservation = await this.prisma.inventoryReservation.findUnique({
      where: { id: reservationId },
    });

    if (!reservation || reservation.releasedAt) return;

    await this.prisma.$transaction(async (tx) => {
      await tx.inventoryReservation.update({
        where: { id: reservationId },
        data: { releasedAt: new Date() },
      });

      await tx.inventoryLevel.update({
        where: { variantId: reservation.variantId },
        data: { reservedQuantity: { decrement: reservation.quantity } },
      });
    });

    if (reservation.jobId) {
      try {
        const job = await this.inventoryQueue.getJob(reservation.jobId);
        if (job) await job.remove();
      } catch (e) {
        this.logger.warn(`Could not remove job ${reservation.jobId}: ${(e as Error).message}`);
      }
    }
  }

  async confirmReservation(reservationId: string, orderId: string): Promise<void> {
    const reservation = await this.prisma.inventoryReservation.findUnique({
      where: { id: reservationId },
    });

    if (!reservation) throw new NotFoundException('Reservation not found');
    if (reservation.confirmedAt) throw new BadRequestException('Reservation already confirmed');

    await this.prisma.$transaction(async (tx) => {
      await tx.inventoryReservation.update({
        where: { id: reservationId },
        data: { confirmedAt: new Date(), orderId },
      });

      await tx.inventoryLevel.update({
        where: { variantId: reservation.variantId },
        data: {
          quantity: { decrement: reservation.quantity },
          reservedQuantity: { decrement: reservation.quantity },
        },
      });

      await tx.inventoryMovement.create({
        data: {
          variantId: reservation.variantId,
          type: InventoryMovementType.RESERVATION_CONFIRMED,
          quantity: -reservation.quantity,
          previousQuantity: 0,
          newQuantity: 0,
          reason: `Confirmed for order ${orderId}`,
          referenceId: orderId,
          referenceType: 'Order',
        },
      });
    });
  }

  async expireReservations(): Promise<number> {
    const expired = await this.prisma.inventoryReservation.findMany({
      where: {
        expiresAt: { lt: new Date() },
        confirmedAt: null,
        releasedAt: null,
      },
    });

    let count = 0;
    for (const reservation of expired) {
      await this.releaseReservation(reservation.id);
      count++;
    }

    return count;
  }

  async getLowStockItems(threshold: number = 10) {
    return this.prisma.inventoryLevel.findMany({
      where: {
        OR: [
          { quantity: { lte: threshold } },
          {
            lowStockThreshold: { not: null },
            quantity: { lte: this.prisma.inventoryLevel.fields.lowStockThreshold as any },
          },
        ],
      },
      include: {
        variant: {
          include: {
            product: { select: { id: true, title: true, slug: true } },
          },
        },
      },
    });
  }

  async getMovements(variantId: string, pagination: PaginationDto) {
    const { page = 1, limit = 20 } = pagination;
    const skip = (page - 1) * limit;

    const [movements, total] = await Promise.all([
      this.prisma.inventoryMovement.findMany({
        where: { variantId },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.inventoryMovement.count({ where: { variantId } }),
    ]);

    return buildPaginatedResponse(movements, total, page, limit);
  }

  async getAllInventory(pagination: PaginationDto) {
    const { page = 1, limit = 20 } = pagination;
    const skip = (page - 1) * limit;

    const [levels, total] = await Promise.all([
      this.prisma.inventoryLevel.findMany({
        skip,
        take: limit,
        include: {
          variant: {
            select: { sku: true, title: true, product: { select: { title: true, slug: true } } },
          },
        },
        orderBy: { updatedAt: 'desc' },
      }),
      this.prisma.inventoryLevel.count(),
    ]);

    return buildPaginatedResponse(
      levels.map((l) => ({ ...l, availableQuantity: l.quantity - l.reservedQuantity })),
      total,
      page,
      limit,
    );
  }

  async getMovementHistory(variantId: string, _page = 1, _limit = 50) {
    return this.prisma.inventoryMovement.findMany({
      where: { variantId },
      orderBy: { createdAt: 'desc' },
    });
  }
}
