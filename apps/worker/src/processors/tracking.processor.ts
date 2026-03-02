import { Process, Processor, OnQueueFailed } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma.service';

export interface TrackingEventJobData {
  trackingEventId: string;
}

interface Ga4EventParams {
  currency?: string;
  value?: number;
  transaction_id?: string;
  items?: Array<{
    item_id: string;
    item_name: string;
    quantity: number;
    price: number;
  }>;
  [key: string]: unknown;
}

interface MetaEventData {
  event_name: string;
  event_time: number;
  event_id?: string;
  user_data: {
    em?: string[];  // hashed email (SHA-256)
    ph?: string[];  // hashed phone
    client_ip_address?: string;
    client_user_agent?: string;
    fbc?: string;   // Facebook click ID
    fbp?: string;   // Facebook browser pixel
  };
  custom_data?: {
    currency?: string;
    value?: number;
    order_id?: string;
    content_ids?: string[];
    content_type?: string;
    num_items?: number;
  };
  action_source: 'website' | 'email' | 'app' | 'physical_store' | 'other';
  event_source_url?: string;
}

@Processor('tracking')
export class TrackingProcessor {
  private readonly logger = new Logger(TrackingProcessor.name);

  // GA4 Measurement Protocol config
  private readonly ga4MeasurementId: string | undefined;
  private readonly ga4ApiSecret: string | undefined;

  // Meta Conversions API config
  private readonly metaPixelId: string | undefined;
  private readonly metaAccessToken: string | undefined;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    this.ga4MeasurementId = this.configService.get<string>('GA4_MEASUREMENT_ID');
    this.ga4ApiSecret = this.configService.get<string>('GA4_API_SECRET');
    this.metaPixelId = this.configService.get<string>('META_PIXEL_ID');
    this.metaAccessToken = this.configService.get<string>('META_ACCESS_TOKEN');
  }

  @Process('send-tracking-event')
  async handleSendTrackingEvent(job: Job<TrackingEventJobData>): Promise<void> {
    const { trackingEventId } = job.data;

    const event = await this.prisma.trackingEvent.findUnique({
      where: { id: trackingEventId },
    });

    if (!event) {
      this.logger.warn(`TrackingEvent ${trackingEventId} not found`);
      return;
    }

    if (event.sentToGa4 && event.sentToMeta) {
      this.logger.debug(`TrackingEvent ${trackingEventId} already sent to all platforms`);
      return;
    }

    // Check consent — only track if user consented
    if (!event.consentGranted) {
      this.logger.debug(
        `TrackingEvent ${trackingEventId} skipped — user has not granted consent`,
      );
      return;
    }

    const payload = event.payload as Record<string, any>;
    let sentToGa4 = event.sentToGa4;
    let sentToMeta = event.sentToMeta;
    const errors: string[] = [];

    // ── GA4 ────────────────────────────────────────────────────────────────
    if (!sentToGa4 && this.ga4MeasurementId && this.ga4ApiSecret) {
      try {
        await this.sendToGa4(event.eventName, payload);
        sentToGa4 = true;
        this.logger.debug(`TrackingEvent ${trackingEventId} sent to GA4`);
      } catch (err) {
        errors.push(`GA4: ${(err as Error).message}`);
        this.logger.warn(`GA4 send failed for ${trackingEventId}: ${(err as Error).message}`);
      }
    } else if (!sentToGa4) {
      this.logger.debug('GA4 credentials not configured — skipping GA4');
      sentToGa4 = true; // Treat as "done" if not configured
    }

    // ── Meta Conversions API ───────────────────────────────────────────────
    if (!sentToMeta && this.metaPixelId && this.metaAccessToken) {
      try {
        await this.sendToMeta(event.eventName, payload, event.id);
        sentToMeta = true;
        this.logger.debug(`TrackingEvent ${trackingEventId} sent to Meta`);
      } catch (err) {
        errors.push(`Meta: ${(err as Error).message}`);
        this.logger.warn(`Meta send failed for ${trackingEventId}: ${(err as Error).message}`);
      }
    } else if (!sentToMeta) {
      this.logger.debug('Meta credentials not configured — skipping Meta');
      sentToMeta = true; // Treat as "done" if not configured
    }

    // Update event record
    await this.prisma.trackingEvent.update({
      where: { id: trackingEventId },
      data: {
        sentToGa4,
        sentToMeta,
        lastError: errors.length > 0 ? errors.join('; ') : null,
        processedAt: new Date(),
      },
    });

    if (errors.length > 0) {
      throw new Error(`Tracking errors: ${errors.join('; ')}`);
    }

    this.logger.log(`TrackingEvent ${trackingEventId} (${event.eventName}) processed`);
  }

  // ─── GA4 Measurement Protocol ───────────────────────────────────────────────

  private async sendToGa4(
    eventName: string,
    payload: Record<string, any>,
  ): Promise<void> {
    const url = `https://www.google-analytics.com/mp/collect?measurement_id=${this.ga4MeasurementId}&api_secret=${this.ga4ApiSecret}`;

    const ga4Params: Ga4EventParams = this.mapToGa4Params(eventName, payload);

    const body = JSON.stringify({
      client_id: payload.clientId ?? payload.userId ?? 'server',
      user_id: payload.userId ?? undefined,
      timestamp_micros: Date.now() * 1000,
      non_personalized_ads: false,
      events: [
        {
          name: eventName,
          params: ga4Params,
        },
      ],
    });

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    });

    // GA4 Measurement Protocol returns 204 on success, 200 with validation errors
    if (!response.ok && response.status !== 204) {
      const text = await response.text().catch(() => '');
      throw new Error(`GA4 HTTP ${response.status}: ${text}`);
    }
  }

  private mapToGa4Params(eventName: string, payload: Record<string, any>): Ga4EventParams {
    const params: Ga4EventParams = {};

    if (payload.currency) params.currency = payload.currency;
    if (payload.valueCents != null) params.value = payload.valueCents / 100;
    if (payload.orderId) params.transaction_id = payload.orderId;
    if (payload.sessionId) params.session_id = payload.sessionId;
    if (payload.engagementTimeMsec != null) {
      params.engagement_time_msec = payload.engagementTimeMsec;
    }

    if (Array.isArray(payload.items)) {
      params.items = payload.items.map((item: any) => ({
        item_id: item.variantId ?? item.productId,
        item_name: item.name,
        quantity: item.quantity,
        price: (item.priceCents ?? 0) / 100,
        item_category: item.category,
        item_brand: item.brand,
      }));
    }

    // Forward any additional event-specific params
    const knownKeys = new Set([
      'clientId', 'userId', 'currency', 'valueCents', 'orderId',
      'sessionId', 'engagementTimeMsec', 'items',
    ]);
    for (const [key, value] of Object.entries(payload)) {
      if (!knownKeys.has(key)) {
        params[key] = value;
      }
    }

    return params;
  }

  // ─── Meta Conversions API ───────────────────────────────────────────────────

  private async sendToMeta(
    eventName: string,
    payload: Record<string, any>,
    eventId: string,
  ): Promise<void> {
    const metaEventName = this.mapToMetaEventName(eventName);
    const url = `https://graph.facebook.com/v19.0/${this.metaPixelId}/events?access_token=${this.metaAccessToken}`;

    const eventData: MetaEventData = {
      event_name: metaEventName,
      event_time: Math.floor(Date.now() / 1000),
      event_id: eventId, // For deduplication with browser pixel
      action_source: 'website',
      event_source_url: payload.pageUrl,
      user_data: {
        client_ip_address: payload.ip,
        client_user_agent: payload.userAgent,
        fbc: payload.fbc,
        fbp: payload.fbp,
      },
      custom_data: {
        currency: payload.currency ?? 'MXN',
        value: payload.valueCents != null ? payload.valueCents / 100 : undefined,
        order_id: payload.orderId,
        content_ids: Array.isArray(payload.items)
          ? payload.items.map((i: any) => i.variantId ?? i.productId)
          : undefined,
        content_type: 'product',
        num_items: Array.isArray(payload.items) ? payload.items.length : undefined,
      },
    };

    // Hash email if present (Meta requires SHA-256 hashed lowercase email)
    if (payload.email) {
      const { createHash } = await import('crypto');
      const hashedEmail = createHash('sha256')
        .update(payload.email.toLowerCase().trim())
        .digest('hex');
      eventData.user_data.em = [hashedEmail];
    }

    // Hash phone if present
    if (payload.phone) {
      const { createHash } = await import('crypto');
      const normalizedPhone = payload.phone.replace(/\D/g, '');
      const hashedPhone = createHash('sha256').update(normalizedPhone).digest('hex');
      eventData.user_data.ph = [hashedPhone];
    }

    const body = JSON.stringify({ data: [eventData] });

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    });

    if (!response.ok) {
      const json = await response.json().catch(() => ({}));
      const message = (json as any)?.error?.message ?? `HTTP ${response.status}`;
      throw new Error(`Meta API error: ${message}`);
    }
  }

  private mapToMetaEventName(eventName: string): string {
    const mapping: Record<string, string> = {
      'view_item': 'ViewContent',
      'add_to_cart': 'AddToCart',
      'begin_checkout': 'InitiateCheckout',
      'purchase': 'Purchase',
      'search': 'Search',
      'view_item_list': 'ViewContent',
      'add_to_wishlist': 'AddToWishlist',
      'lead': 'Lead',
      'complete_registration': 'CompleteRegistration',
    };
    return mapping[eventName] ?? eventName;
  }

  @OnQueueFailed()
  onFailed(job: Job<TrackingEventJobData>, error: Error): void {
    this.logger.error(
      `Tracking job ${job.id} failed after ${job.attemptsMade} attempt(s): ${error.message}`,
      error.stack,
    );
  }
}
