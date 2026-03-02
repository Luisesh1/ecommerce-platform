import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { buildPaginatedResponse } from '../common/dto/pagination.dto';
import {
  UpdateOrderStatusDto,
  ProcessRefundDto,
  CancelOrderDto,
  OrderFilterDto,
} from './dto/order.dto';
import { OrderStatus, PaymentStatus } from '@prisma/client';

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  private readonly orderInclude = {
    lineItems: true,
    timeline: { orderBy: { createdAt: 'asc' as const } },
    payments: true,
    refunds: true,
    shippingAddress: true,
    billingAddress: true,
    customer: {
      select: { id: true, email: true, firstName: true, lastName: true },
    },
  };

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
  ) {}

  async getOrders(filters: OrderFilterDto) {
    const { page = 1, limit = 20, status, customerId, search, dateFrom, dateTo } = filters;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (status) where.status = status;
    if (customerId) where.customerId = customerId;
    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) where.createdAt.gte = new Date(dateFrom);
      if (dateTo) where.createdAt.lte = new Date(dateTo);
    }
    if (search) {
      where.OR = [
        { orderNumber: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [orders, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        include: this.orderInclude,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.order.count({ where }),
    ]);

    return buildPaginatedResponse(orders, total, page, limit);
  }

  async getMyOrders(userId: string, pagination: { page?: number; limit?: number }) {
    const page = pagination.page ?? 1;
    const limit = pagination.limit ?? 20;
    const skip = (page - 1) * limit;

    const [orders, total] = await Promise.all([
      this.prisma.order.findMany({
        where: { customerId: userId },
        include: {
          lineItems: true,
          timeline: { orderBy: { createdAt: 'asc' }, take: 1 },
          shippingAddress: true,
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.order.count({ where: { customerId: userId } }),
    ]);

    return buildPaginatedResponse(orders, total, page, limit);
  }

  async getOrder(id: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: this.orderInclude,
    });
    if (!order) throw new NotFoundException(`Order ${id} not found`);
    return order;
  }

  async getMyOrder(id: string, userId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: this.orderInclude,
    });
    if (!order) throw new NotFoundException(`Order ${id} not found`);
    if (order.customerId !== userId) throw new ForbiddenException('Access denied');
    return order;
  }

  async updateOrderStatus(id: string, dto: UpdateOrderStatusDto, updatedBy?: string) {
    const order = await this.getOrder(id);

    const updated = await this.prisma.order.update({
      where: { id },
      data: {
        status: dto.status,
        ...(dto.trackingNumber && { trackingNumber: dto.trackingNumber }),
        ...(dto.trackingUrl && { trackingUrl: dto.trackingUrl }),
        ...(dto.status === OrderStatus.DELIVERED && { fulfilledAt: new Date() }),
      },
    });

    await this.prisma.orderTimeline.create({
      data: {
        orderId: id,
        status: dto.status,
        message: dto.message ?? `Status updated to ${dto.status}`,
        createdBy: updatedBy,
      },
    });

    try {
      if (dto.status === OrderStatus.SHIPPED && dto.trackingNumber) {
        await this.emailService.sendOrderShipped(updated, dto.trackingNumber, order.email);
      } else if (dto.status === OrderStatus.DELIVERED) {
        await this.emailService.sendOrderDelivered(updated, order.email);
      }
    } catch (err) {
      this.logger.error(`Failed to send status email: ${(err as Error).message}`);
    }

    return this.getOrder(id);
  }

  async cancelOrder(id: string, dto: CancelOrderDto, userId?: string, isAdmin: boolean = false) {
    const order = await this.getOrder(id);

    const cancellableStatuses: OrderStatus[] = [
      OrderStatus.PENDING,
      OrderStatus.PAYMENT_PENDING,
      OrderStatus.CONFIRMED,
    ];

    if (!isAdmin && !cancellableStatuses.includes(order.status)) {
      throw new BadRequestException('Order cannot be cancelled at this stage');
    }

    if (!isAdmin && order.customerId !== userId) {
      throw new ForbiddenException('Access denied');
    }

    await this.prisma.order.update({
      where: { id },
      data: {
        status: OrderStatus.CANCELLED,
        cancelReason: dto.reason,
        cancelledAt: new Date(),
      },
    });

    await this.prisma.orderTimeline.create({
      data: {
        orderId: id,
        status: OrderStatus.CANCELLED,
        message: `Cancelled: ${dto.reason}`,
        createdBy: userId,
      },
    });

    return this.getOrder(id);
  }

  async processRefund(id: string, dto: ProcessRefundDto, adminUserId: string) {
    const order = await this.getOrder(id);
    const payment = order.payments.find((p: any) => p.id === dto.paymentId);
    if (!payment) throw new NotFoundException('Payment not found');

    const existingRefunds = order.refunds.reduce((sum: number, r: any) => sum + r.amount, 0);
    const maxRefund = payment.amount - existingRefunds;

    if (dto.amount > maxRefund) {
      throw new BadRequestException(`Refund amount exceeds maximum refundable amount: ${maxRefund}`);
    }

    const refund = await this.prisma.refund.create({
      data: {
        orderId: id,
        paymentId: dto.paymentId,
        amount: dto.amount,
        reason: dto.reason,
        note: dto.note,
        status: PaymentStatus.REFUND_PENDING,
        lineItems: (dto.lineItems ?? []) as any,
      },
    });

    const totalRefunded = existingRefunds + dto.amount;
    const newStatus =
      totalRefunded >= payment.amount
        ? OrderStatus.FULLY_REFUNDED
        : OrderStatus.PARTIALLY_REFUNDED;

    await this.prisma.order.update({
      where: { id },
      data: { status: newStatus },
    });

    await this.prisma.orderTimeline.create({
      data: {
        orderId: id,
        status: newStatus,
        message: `Refund of $${dto.amount / 100} processed. Reason: ${dto.reason}`,
        createdBy: adminUserId,
      },
    });

    try {
      await this.emailService.sendRefundConfirmation(refund, order.email);
    } catch (err) {
      this.logger.error(`Failed to send refund email: ${(err as Error).message}`);
    }

    return refund;
  }

  async generatePackingSlip(id: string): Promise<Buffer> {
    const order = await this.getOrder(id);

    const content = `
PACKING SLIP
============
Order: ${order.orderNumber}
Date: ${new Date(order.createdAt).toLocaleDateString()}
Customer: ${order.email}

ITEMS:
${(order.lineItems as any[]).map((item: any) => `  - ${item.title} (${item.variantTitle}) x${item.quantity}`).join('\n')}

SHIPPING TO:
${order.shippingAddress ? `${(order.shippingAddress as any).firstName} ${(order.shippingAddress as any).lastName}\n${(order.shippingAddress as any).address1}\n${(order.shippingAddress as any).city}, ${(order.shippingAddress as any).state} ${(order.shippingAddress as any).postalCode}` : order.email}

TOTALS:
Subtotal: $${order.subtotal / 100}
Shipping: $${order.shippingAmount / 100}
Tax: $${order.taxAmount / 100}
Total: $${order.totalAmount / 100} ${order.currency}
    `.trim();

    return Buffer.from(content, 'utf-8');
  }

  async addTimeline(orderId: string, status: OrderStatus, message: string, createdBy?: string) {
    await this.getOrder(orderId);
    return this.prisma.orderTimeline.create({
      data: { orderId, status, message, createdBy },
    });
  }
}
