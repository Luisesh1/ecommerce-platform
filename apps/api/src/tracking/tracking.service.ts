import { Injectable, Logger, Inject } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import IORedis from 'ioredis';
import { REDIS_CLIENT } from '../redis/redis.module';
import { TrackEventDto, TrackingConfig, UpdateTrackingConfigDto } from './dto/tracking.dto';

const TRACKING_CONFIG_KEY = 'settings:tracking';
const DEDUP_TTL_SECONDS = 86_400; // 24 hours

@Injectable()
export class TrackingService {
  private readonly logger = new Logger(TrackingService.name);

  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: IORedis,
    @InjectQueue('tracking') private readonly trackingQueue: Queue,
  ) {}

  /**
   * Ingests a tracking event.
   * - Deduplicates by event_id (Redis SET NX, TTL 24h).
   * - Enqueues a BullMQ job for async GA4/Meta forwarding.
   * Returns { queued: true } or { queued: false, reason: 'duplicate' }.
   */
  async ingestEvent(dto: TrackEventDto): Promise<{ queued: boolean; reason?: string }> {
    const dedupKey = `tracking:dedup:${dto.event_id}`;
    // SET NX with TTL — returns 'OK' on first set, null if already exists
    const result = await this.redis.set(dedupKey, '1', 'EX', DEDUP_TTL_SECONDS, 'NX');

    if (result === null) {
      this.logger.debug(`Duplicate event skipped: ${dto.event_id}`);
      return { queued: false, reason: 'duplicate' };
    }

    await this.trackingQueue.add(
      'process-event',
      {
        event_name: dto.event_name,
        event_id: dto.event_id,
        user_id: dto.user_id,
        session_id: dto.session_id,
        params: dto.params ?? {},
        receivedAt: new Date().toISOString(),
      },
      {
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: 100,
        removeOnFail: 200,
      },
    );

    return { queued: true };
  }

  async getConfig(): Promise<TrackingConfig> {
    const raw = await this.redis.get(TRACKING_CONFIG_KEY);
    if (!raw) {
      return { ga4_enabled: false, meta_enabled: false };
    }
    try {
      return JSON.parse(raw) as TrackingConfig;
    } catch {
      return { ga4_enabled: false, meta_enabled: false };
    }
  }

  async updateConfig(dto: UpdateTrackingConfigDto): Promise<TrackingConfig> {
    const current = await this.getConfig();
    const updated: TrackingConfig = {
      ...current,
      ...dto,
      ga4_enabled: dto.ga4_enabled ?? current.ga4_enabled,
      meta_enabled: dto.meta_enabled ?? current.meta_enabled,
    };
    await this.redis.set(TRACKING_CONFIG_KEY, JSON.stringify(updated));
    return updated;
  }

  /**
   * Send event to GA4 Measurement Protocol.
   * Called by the worker, not the API directly.
   */
  async sendToGA4(
    event: { event_name: string; params?: Record<string, unknown>; user_id?: string },
    config: TrackingConfig,
  ): Promise<void> {
    if (!config.ga4_enabled || !config.ga4_measurement_id || !config.ga4_api_secret) {
      return;
    }

    const url = `https://www.google-analytics.com/mp/collect?measurement_id=${config.ga4_measurement_id}&api_secret=${config.ga4_api_secret}`;

    const body = JSON.stringify({
      client_id: event.user_id ?? 'anonymous',
      events: [
        {
          name: event.event_name,
          params: event.params ?? {},
        },
      ],
    });

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
      });
      if (!response.ok) {
        this.logger.warn(`GA4 returned HTTP ${response.status}`);
      }
    } catch (err) {
      this.logger.error(`GA4 forwarding failed: ${(err as Error).message}`);
      throw err;
    }
  }

  /**
   * Send event to Meta Conversions API.
   * Called by the worker, not the API directly.
   */
  async sendToMeta(
    event: {
      event_name: string;
      event_id: string;
      user_id?: string;
      session_id: string;
      params?: Record<string, unknown>;
    },
    config: TrackingConfig,
  ): Promise<void> {
    if (!config.meta_enabled || !config.meta_pixel_id || !config.meta_access_token) {
      return;
    }

    const url = `https://graph.facebook.com/v18.0/${config.meta_pixel_id}/events?access_token=${config.meta_access_token}`;

    const body = JSON.stringify({
      data: [
        {
          event_name: event.event_name,
          event_id: event.event_id,
          event_time: Math.floor(Date.now() / 1000),
          action_source: 'website',
          user_data: {
            client_user_agent: '',
            ...(event.user_id && { external_id: event.user_id }),
          },
          custom_data: event.params ?? {},
        },
      ],
    });

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
      });
      if (!response.ok) {
        const text = await response.text();
        this.logger.warn(`Meta CAPI returned HTTP ${response.status}: ${text}`);
      }
    } catch (err) {
      this.logger.error(`Meta CAPI forwarding failed: ${(err as Error).message}`);
      throw err;
    }
  }
}
