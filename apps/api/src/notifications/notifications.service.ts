import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import * as webpush from 'web-push';

export interface PushNotificationPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  image?: string;
  url?: string;
  tag?: string;
  data?: Record<string, unknown>;
}

export interface PushSubscriptionDto {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
  userAgent?: string;
}

@Injectable()
export class NotificationsService implements OnModuleInit {
  private readonly logger = new Logger(NotificationsService.name);
  private vapidPublicKey: string;
  private vapidConfigured = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  onModuleInit() {
    const vapidPublicKey = this.configService.get<string>('VAPID_PUBLIC_KEY', '');
    const vapidPrivateKey = this.configService.get<string>('VAPID_PRIVATE_KEY', '');
    const vapidSubject = this.configService.get<string>('VAPID_SUBJECT', 'mailto:admin@example.com');

    this.vapidPublicKey = vapidPublicKey;

    if (vapidPublicKey && vapidPrivateKey) {
      try {
        webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
        this.vapidConfigured = true;
        this.logger.log('Web Push (VAPID) configured successfully');
      } catch (err) {
        this.logger.error(`Failed to configure VAPID: ${(err as Error).message}`);
      }
    } else {
      this.logger.warn('VAPID_PUBLIC_KEY or VAPID_PRIVATE_KEY not set; push notifications disabled');
    }
  }

  getVapidPublicKey(): string {
    return this.vapidPublicKey;
  }

  // ─── SUBSCRIPTIONS ─────────────────────────────────────────────────────

  async subscribe(
    userId: string | undefined,
    sessionId: string | undefined,
    dto: PushSubscriptionDto,
  ) {
    const subscription = await this.prisma.pushSubscription.upsert({
      where: { endpoint: dto.endpoint },
      create: {
        customerId: userId ?? null,
        sessionId: sessionId ?? null,
        endpoint: dto.endpoint,
        p256dhKey: dto.keys.p256dh,
        authKey: dto.keys.auth,
        userAgent: dto.userAgent ?? null,
        isActive: true,
      },
      update: {
        customerId: userId ?? null,
        p256dhKey: dto.keys.p256dh,
        authKey: dto.keys.auth,
        isActive: true,
        updatedAt: new Date(),
      },
    });

    this.logger.log(`Push subscription saved for ${userId ? `user ${userId}` : `session ${sessionId}`}`);
    return subscription;
  }

  async unsubscribe(endpoint: string): Promise<void> {
    await this.prisma.pushSubscription.updateMany({
      where: { endpoint },
      data: { isActive: false },
    });
    this.logger.log(`Push subscription deactivated: ${endpoint}`);
  }

  // ─── SEND NOTIFICATIONS ─────────────────────────────────────────────────

  async sendToUser(userId: string, notification: PushNotificationPayload): Promise<void> {
    if (!this.vapidConfigured) {
      this.logger.warn('Cannot send push notification: VAPID not configured');
      return;
    }

    const subscriptions = await this.prisma.pushSubscription.findMany({
      where: { customerId: userId, isActive: true },
    });

    if (subscriptions.length === 0) {
      this.logger.debug(`No active push subscriptions for user ${userId}`);
      return;
    }

    await this.sendToSubscriptions(subscriptions, notification);
  }

  async sendToAll(notification: PushNotificationPayload): Promise<{ sent: number; failed: number }> {
    if (!this.vapidConfigured) {
      this.logger.warn('Cannot send push notification: VAPID not configured');
      return { sent: 0, failed: 0 };
    }

    const subscriptions = await this.prisma.pushSubscription.findMany({
      where: { isActive: true },
    });

    return this.sendToSubscriptions(subscriptions, notification);
  }

  private async sendToSubscriptions(
    subscriptions: Array<{ endpoint: string; p256dhKey: string; authKey: string }>,
    notification: PushNotificationPayload,
  ): Promise<{ sent: number; failed: number }> {
    let sent = 0;
    let failed = 0;

    const payload = JSON.stringify(notification);
    const staleEndpoints: string[] = [];

    await Promise.all(
      subscriptions.map(async (sub) => {
        try {
          await webpush.sendNotification(
            {
              endpoint: sub.endpoint,
              keys: {
                p256dh: sub.p256dhKey,
                auth: sub.authKey,
              },
            },
            payload,
            {
              TTL: 86400, // 24 hours
              urgency: 'normal',
            },
          );
          sent++;
        } catch (err) {
          failed++;
          const statusCode = (err as { statusCode?: number }).statusCode;
          if (statusCode === 410 || statusCode === 404) {
            // Subscription expired / invalid
            staleEndpoints.push(sub.endpoint);
            this.logger.debug(`Stale push subscription removed: ${sub.endpoint}`);
          } else {
            this.logger.warn(`Push send failed for ${sub.endpoint}: ${(err as Error).message}`);
          }
        }
      }),
    );

    // Deactivate stale subscriptions
    if (staleEndpoints.length > 0) {
      await this.prisma.pushSubscription.updateMany({
        where: { endpoint: { in: staleEndpoints } },
        data: { isActive: false },
      });
    }

    return { sent, failed };
  }
}
