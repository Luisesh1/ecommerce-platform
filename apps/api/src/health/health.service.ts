import { Injectable, Logger, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { REDIS_CLIENT } from '../redis/redis.module';
import IORedis from 'ioredis';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';

export interface ServiceCheck {
  status: 'ok' | 'degraded' | 'down';
  latencyMs: number;
  message?: string;
}

export interface HealthStatus {
  status: 'ok' | 'degraded';
  db: ServiceCheck;
  redis: ServiceCheck;
  search: ServiceCheck;
  timestamp: string;
}

export interface QueueStats {
  name: string;
  waiting: number;
  active: number;
  completed: number;
  failed: number;
}

export interface DetailedHealthStatus extends HealthStatus {
  queues: QueueStats[];
  pendingWebhooks: number;
  pendingPayments: number;
}

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);
  private readonly meilisearchHost: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    @Inject(REDIS_CLIENT) private readonly redis: IORedis,
    @InjectQueue('inventory') private readonly inventoryQueue: Queue,
    @InjectQueue('email') private readonly emailQueue: Queue,
  ) {
    this.meilisearchHost = this.configService.get<string>(
      'MEILISEARCH_HOST',
      this.configService.get<string>('MEILI_HOST', 'http://localhost:7700'),
    );
  }

  async checkDatabase(): Promise<ServiceCheck> {
    const start = Date.now();
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: 'ok', latencyMs: Date.now() - start };
    } catch (err) {
      this.logger.error(`DB health check failed: ${(err as Error).message}`);
      return { status: 'down', latencyMs: Date.now() - start, message: (err as Error).message };
    }
  }

  async checkRedis(): Promise<ServiceCheck> {
    const start = Date.now();
    try {
      const pong = await this.redis.ping();
      if (pong === 'PONG') {
        return { status: 'ok', latencyMs: Date.now() - start };
      }
      return { status: 'degraded', latencyMs: Date.now() - start, message: `Unexpected ping response: ${pong}` };
    } catch (err) {
      this.logger.error(`Redis health check failed: ${(err as Error).message}`);
      return { status: 'down', latencyMs: Date.now() - start, message: (err as Error).message };
    }
  }

  async checkSearch(): Promise<ServiceCheck> {
    const start = Date.now();
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3000);

      const response = await fetch(`${this.meilisearchHost}/health`, {
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (response.ok) {
        return { status: 'ok', latencyMs: Date.now() - start };
      }
      return { status: 'degraded', latencyMs: Date.now() - start, message: `HTTP ${response.status}` };
    } catch (err) {
      this.logger.warn(`MeiliSearch health check failed: ${(err as Error).message}`);
      return { status: 'down', latencyMs: Date.now() - start, message: (err as Error).message };
    }
  }

  async getBasicHealth(): Promise<HealthStatus> {
    const [db, redis, search] = await Promise.all([
      this.checkDatabase(),
      this.checkRedis(),
      this.checkSearch(),
    ]);

    const allChecks = [db, redis, search];
    const hasDown = allChecks.some((c) => c.status === 'down');
    const hasDegraded = allChecks.some((c) => c.status === 'degraded');

    return {
      status: hasDown || hasDegraded ? 'degraded' : 'ok',
      db,
      redis,
      search,
      timestamp: new Date().toISOString(),
    };
  }

  async getDetailedHealth(): Promise<DetailedHealthStatus> {
    const basic = await this.getBasicHealth();

    // Queue stats
    const queues: QueueStats[] = await Promise.all(
      [
        { name: 'inventory', queue: this.inventoryQueue },
        { name: 'email', queue: this.emailQueue },
      ].map(async ({ name, queue }) => {
        try {
          const [waiting, active, completed, failed] = await Promise.all([
            queue.getWaitingCount(),
            queue.getActiveCount(),
            queue.getCompletedCount(),
            queue.getFailedCount(),
          ]);
          return { name, waiting, active, completed, failed };
        } catch {
          return { name, waiting: -1, active: -1, completed: -1, failed: -1 };
        }
      }),
    );

    // Pending counts from DB
    let pendingWebhooks = 0;
    let pendingPayments = 0;

    try {
      pendingWebhooks = await this.prisma.webhookEvent.count({
        where: { status: 'PENDING' },
      });
    } catch {
      pendingWebhooks = -1;
    }

    try {
      pendingPayments = await this.prisma.payment.count({
        where: { status: 'PENDING' },
      });
    } catch {
      pendingPayments = -1;
    }

    return {
      ...basic,
      queues,
      pendingWebhooks,
      pendingPayments,
    };
  }
}
