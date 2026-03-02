import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditAction } from '@prisma/client';
import { buildPaginatedResponse } from '../common/dto/pagination.dto';

export interface AuditLogData {
  userId?: string;
  userEmail?: string;
  action: AuditAction;
  entity: string;
  entityId: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  diff?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

export interface AuditListFilters {
  userId?: string;
  entity?: string;
  action?: AuditAction;
  from?: Date;
  to?: Date;
  page?: number;
  limit?: number;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Creates an audit log entry. Fire-and-forget safe (errors are swallowed).
   */
  async log(data: AuditLogData): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          action: data.action,
          entityType: data.entity,
          entityId: data.entityId,
          userId: data.userId ?? null,
          userEmail: data.userEmail ?? null,
          ipAddress: data.ipAddress ?? null,
          userAgent: data.userAgent ?? null,
          beforeData: data.before ? (data.before as object) : undefined,
          afterData: data.after ? (data.after as object) : undefined,
          diffData: data.diff ? (data.diff as object) : undefined,
          metadata: data.metadata ? (data.metadata as object) : undefined,
        },
      });
    } catch (err) {
      this.logger.error(`Failed to create audit log: ${(err as Error).message}`, (err as Error).stack);
    }
  }

  /**
   * Lists audit logs with optional filters and pagination.
   */
  async findAll(filters: AuditListFilters) {
    const { userId, entity, action, from, to, page = 1, limit = 20 } = filters;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};

    if (userId) where['userId'] = userId;
    if (entity) where['entityType'] = entity;
    if (action) where['action'] = action;
    if (from || to) {
      where['createdAt'] = {
        ...(from && { gte: from }),
        ...(to && { lte: to }),
      };
    }

    const [data, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        include: {
          user: {
            select: { id: true, email: true, firstName: true, lastName: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return buildPaginatedResponse(data, total, page, limit);
  }

  /**
   * Get a single audit log by ID.
   */
  async findById(id: string) {
    return this.prisma.auditLog.findUnique({
      where: { id },
      include: {
        user: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
      },
    });
  }
}
