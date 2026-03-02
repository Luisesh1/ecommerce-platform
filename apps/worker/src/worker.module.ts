import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bull';

import { EmailProcessor } from './processors/email.processor';
import { WebhookProcessor } from './processors/webhook.processor';
import { InventoryExpiryProcessor } from './processors/inventory-expiry.processor';
import { AbandonedCartProcessor } from './processors/abandoned-cart.processor';
import { SearchIndexProcessor } from './processors/search-index.processor';
import { ImportExportProcessor } from './processors/import-export.processor';
import { NotificationProcessor } from './processors/notification.processor';
import { BackInStockProcessor } from './processors/back-in-stock.processor';
import { TrackingProcessor } from './processors/tracking.processor';
import { PrismaService } from './prisma.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),

    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        redis: {
          host: configService.get<string>('REDIS_HOST', 'localhost'),
          port: configService.get<number>('REDIS_PORT', 6379),
          password: configService.get<string>('REDIS_PASSWORD'),
        },
        defaultJobOptions: {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 1000,
          },
          removeOnComplete: 100,
          removeOnFail: 500,
        },
      }),
      inject: [ConfigService],
    }),

    // Register all queues consumed by this worker
    BullModule.registerQueue(
      { name: 'emails' },
      { name: 'webhooks' },
      { name: 'inventory' },
      { name: 'abandoned-carts' },
      { name: 'search-index' },
      { name: 'import-export' },
      { name: 'notifications' },
      { name: 'back-in-stock' },
      { name: 'tracking' },
    ),
  ],

  providers: [
    PrismaService,

    // Queue processors
    EmailProcessor,
    WebhookProcessor,
    InventoryExpiryProcessor,
    AbandonedCartProcessor,
    SearchIndexProcessor,
    ImportExportProcessor,
    NotificationProcessor,
    BackInStockProcessor,
    TrackingProcessor,
  ],
})
export class WorkerModule {}
