import {
  Injectable,
  Logger,
  Inject,
  InternalServerErrorException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { ConfigService } from '@nestjs/config';
import IORedis from 'ioredis';
import { REDIS_CLIENT } from '../redis/redis.module';

const SETTINGS_HASH_KEY = 'settings:store';
const SENSITIVE_MARKER = '__encrypted__:';
const ALGORITHM = 'aes-256-gcm';

// Keys that should be stored encrypted
const SENSITIVE_KEYS = new Set([
  'stripe_secret_key',
  'stripe_webhook_secret',
  'mercadopago_access_token',
  'paypal_client_secret',
  'smtp_password',
  'sendgrid_api_key',
  'twilio_auth_token',
  's3_secret_access_key',
  'meta_access_token',
  'ga4_api_secret',
]);

@Injectable()
export class SettingsService {
  private readonly logger = new Logger(SettingsService.name);
  private readonly encryptionKey: Buffer;

  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: IORedis,
    private readonly configService: ConfigService,
  ) {
    const masterKey = this.configService.get<string>(
      'MASTER_ENCRYPTION_KEY',
      '0000000000000000000000000000000000000000000000000000000000000000',
    );
    this.encryptionKey = Buffer.from(masterKey, 'hex');
  }

  // ── Core get/set ──────────────────────────────────────────────────────────

  async get(key: string): Promise<string | null> {
    const raw = await this.redis.hget(SETTINGS_HASH_KEY, key);
    if (!raw) return null;

    if (raw.startsWith(SENSITIVE_MARKER)) {
      try {
        return this.decrypt(raw.slice(SENSITIVE_MARKER.length));
      } catch (err) {
        this.logger.error(`Failed to decrypt setting "${key}": ${(err as Error).message}`);
        return null;
      }
    }

    return raw;
  }

  async set(key: string, value: string, sensitive?: boolean): Promise<void> {
    const isActuallySensitive = sensitive ?? SENSITIVE_KEYS.has(key);
    const stored = isActuallySensitive
      ? SENSITIVE_MARKER + this.encrypt(value)
      : value;
    await this.redis.hset(SETTINGS_HASH_KEY, key, stored);
  }

  async delete(key: string): Promise<void> {
    await this.redis.hdel(SETTINGS_HASH_KEY, key);
  }

  /**
   * Returns all settings matching the given namespace prefix (e.g. 'general', 'email').
   * Sensitive values are decrypted; the returned map uses the full key name.
   */
  async getAll(namespace: string): Promise<Record<string, string | null>> {
    const all = await this.redis.hgetall(SETTINGS_HASH_KEY);
    const result: Record<string, string | null> = {};

    for (const [key, raw] of Object.entries(all)) {
      if (!key.startsWith(`${namespace}:`)) continue;

      if (raw.startsWith(SENSITIVE_MARKER)) {
        try {
          result[key] = this.decrypt(raw.slice(SENSITIVE_MARKER.length));
        } catch {
          result[key] = null;
        }
      } else {
        result[key] = raw;
      }
    }

    return result;
  }

  /**
   * Bulk-set settings from a namespace-prefixed object.
   */
  async setMany(
    settings: Record<string, string>,
    namespace?: string,
  ): Promise<void> {
    const pipeline = this.redis.pipeline();

    for (const [key, value] of Object.entries(settings)) {
      const fullKey = namespace ? `${namespace}:${key}` : key;
      const isActuallySensitive = SENSITIVE_KEYS.has(key) || SENSITIVE_KEYS.has(fullKey);
      const stored = isActuallySensitive
        ? SENSITIVE_MARKER + this.encrypt(value)
        : value;
      pipeline.hset(SETTINGS_HASH_KEY, fullKey, stored);
    }

    await pipeline.exec();
  }

  // ── Structured accessors ─────────────────────────────────────────────────

  async getAllSettings(): Promise<{
    general: Record<string, string | null>;
    email: Record<string, string | null>;
    notifications: Record<string, string | null>;
    integrations: Record<string, string | null>;
  }> {
    const [general, email, notifications, integrations] = await Promise.all([
      this.getAll('general'),
      this.getAll('email'),
      this.getAll('notifications'),
      this.getAll('integrations'),
    ]);

    return { general, email, notifications, integrations };
  }

  // ── Payment gateway configs ──────────────────────────────────────────────

  async getGatewayConfig(
    gatewayName: string,
  ): Promise<Record<string, string | null>> {
    return this.getAll(`gateway:${gatewayName}`);
  }

  async getAllGatewayConfigs(): Promise<Record<string, Record<string, string | null>>> {
    const all = await this.redis.hgetall(SETTINGS_HASH_KEY);
    const gateways: Record<string, Record<string, string | null>> = {};

    for (const [key, raw] of Object.entries(all)) {
      if (!key.startsWith('gateway:')) continue;

      const [, gatewayName, field] = key.split(':');
      if (!gatewayName || !field) continue;

      if (!gateways[gatewayName]) gateways[gatewayName] = {};

      const isSensitive = raw.startsWith(SENSITIVE_MARKER);
      if (isSensitive) {
        // Mask sensitive values instead of exposing them
        gateways[gatewayName]![field] = '***';
      } else {
        gateways[gatewayName]![field] = raw;
      }
    }

    return gateways;
  }

  async setGatewayConfig(
    gatewayName: string,
    config: Record<string, string>,
  ): Promise<void> {
    await this.setMany(config, `gateway:${gatewayName}`);
  }

  // ── Encryption helpers ────────────────────────────────────────────────────

  private encrypt(plaintext: string): string {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(ALGORITHM, this.encryptionKey, iv);
    const encrypted = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final(),
    ]);
    const authTag = cipher.getAuthTag();
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
  }

  private decrypt(data: string): string {
    const parts = data.split(':');
    if (parts.length !== 3) {
      throw new InternalServerErrorException('Invalid encrypted data format');
    }
    const [ivHex, authTagHex, encryptedHex] = parts as [string, string, string];
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const encrypted = Buffer.from(encryptedHex, 'hex');

    const decipher = crypto.createDecipheriv(ALGORITHM, this.encryptionKey, iv);
    decipher.setAuthTag(authTag);
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    return decrypted.toString('utf8');
  }
}
