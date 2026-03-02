import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({
      log: [
        { emit: 'event', level: 'query' },
        { emit: 'event', level: 'error' },
        { emit: 'event', level: 'info' },
        { emit: 'event', level: 'warn' },
      ],
      errorFormat: 'colorless',
    });

    if (process.env['NODE_ENV'] === 'development') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (this as any).$on('query', (event: { query: string; duration: number }) => {
        if (event.duration > 200) {
          this.logger.warn(
            `Slow query (${event.duration}ms): ${event.query.substring(0, 200)}`,
          );
        }
      });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (this as any).$on('error', (event: { message: string; target: string }) => {
      this.logger.error(`Prisma error on ${event.target}: ${event.message}`);
    });
  }

  async onModuleInit() {
    try {
      await this.$connect();
      this.logger.log('Database connection established');
    } catch (error) {
      this.logger.error('Failed to connect to database', error);
      throw error;
    }
  }

  async onModuleDestroy() {
    try {
      await this.$disconnect();
      this.logger.log('Database connection closed');
    } catch (error) {
      this.logger.error('Error disconnecting from database', error);
    }
  }

  enableShutdownHooks(app: { close: () => Promise<void> }) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (this as any).$on('beforeExit', async () => {
      this.logger.log('Prisma beforeExit: closing application...');
      await app.close();
    });
  }

  async withTransaction<T>(
    fn: (
      prisma: Omit<
        PrismaService,
        '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
      >,
    ) => Promise<T>,
    options?: { maxWait?: number; timeout?: number },
  ): Promise<T> {
    return this.$transaction(fn as Parameters<typeof this.$transaction>[0], {
      maxWait: options?.maxWait ?? 5000,
      timeout: options?.timeout ?? 10000,
    }) as Promise<T>;
  }

  async healthCheck(): Promise<{ status: 'ok' | 'error'; latencyMs: number }> {
    const start = Date.now();
    try {
      await this.$queryRaw`SELECT 1`;
      return { status: 'ok', latencyMs: Date.now() - start };
    } catch {
      return { status: 'error', latencyMs: Date.now() - start };
    }
  }
}
