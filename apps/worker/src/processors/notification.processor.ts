import { Process, Processor, OnQueueFailed } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import * as webPush from 'web-push';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma.service';

export interface SendPushNotificationJobData {
  /** Target a single subscription by ID */
  subscriptionId?: string;
  /** Target all subscriptions for a customer */
  customerId?: string;
  notification: {
    title: string;
    body: string;
    icon?: string;
    badge?: string;
    image?: string;
    url?: string;
    tag?: string;
    data?: Record<string, unknown>;
  };
}

@Processor('notifications')
export class NotificationProcessor {
  private readonly logger = new Logger(NotificationProcessor.name);
  private readonly vapidConfigured: boolean;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    const publicKey = this.configService.get<string>('VAPID_PUBLIC_KEY');
    const privateKey = this.configService.get<string>('VAPID_PRIVATE_KEY');
    const subject = this.configService.get<string>('VAPID_SUBJECT', 'mailto:admin@example.com');

    if (publicKey && privateKey) {
      webPush.setVapidDetails(subject, publicKey, privateKey);
      this.vapidConfigured = true;
    } else {
      this.logger.warn('VAPID keys not configured — push notifications will not be sent');
      this.vapidConfigured = false;
    }
  }

  @Process('send-push-notification')
  async handleSendPushNotification(job: Job<SendPushNotificationJobData>): Promise<void> {
    if (!this.vapidConfigured) {
      this.logger.warn('Skipping push notification — VAPID not configured');
      return;
    }

    const { subscriptionId, customerId, notification } = job.data;

    if (!subscriptionId && !customerId) {
      throw new Error('Either subscriptionId or customerId must be provided');
    }

    // Collect target subscriptions
    const subscriptions = await this.prisma.pushSubscription.findMany({
      where: {
        ...(subscriptionId ? { id: subscriptionId } : {}),
        ...(customerId ? { customerId } : {}),
        isActive: true,
      },
    });

    if (subscriptions.length === 0) {
      this.logger.debug(
        `No active push subscriptions found for ${subscriptionId ?? customerId}`,
      );
      return;
    }

    const payload = JSON.stringify({
      title: notification.title,
      body: notification.body,
      icon: notification.icon ?? '/icons/icon-192x192.png',
      badge: notification.badge ?? '/icons/badge-72x72.png',
      image: notification.image,
      tag: notification.tag,
      data: {
        url: notification.url ?? '/',
        ...notification.data,
      },
    });

    let sent = 0;
    let expired = 0;
    let failed = 0;

    for (const sub of subscriptions) {
      try {
        const pushSubscription: webPush.PushSubscription = {
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.p256dh,
            auth: sub.auth,
          },
        };

        await webPush.sendNotification(pushSubscription, payload, {
          TTL: 86400, // 24 hours
          urgency: 'normal',
        });

        sent++;
        this.logger.debug(`Push sent to subscription ${sub.id}`);
      } catch (err: any) {
        if (err.statusCode === 410 || err.statusCode === 404) {
          // Subscription has expired or is invalid — remove it
          await this.prisma.pushSubscription.update({
            where: { id: sub.id },
            data: { isActive: false, expiredAt: new Date() },
          });
          expired++;
          this.logger.debug(`Subscription ${sub.id} expired (${err.statusCode}) — deactivated`);
        } else {
          failed++;
          this.logger.error(
            `Failed to send push to subscription ${sub.id}: ${err.message}`,
            err.stack,
          );
        }
      }
    }

    this.logger.log(
      `Push notification sent: ${sent} delivered, ${expired} expired, ${failed} failed`,
    );

    if (failed > 0) {
      throw new Error(`${failed} push notification(s) failed to send`);
    }
  }

  @OnQueueFailed()
  onFailed(job: Job<SendPushNotificationJobData>, error: Error): void {
    this.logger.error(
      `Notification job ${job.id} failed after ${job.attemptsMade} attempt(s): ${error.message}`,
      error.stack,
    );
  }
}
