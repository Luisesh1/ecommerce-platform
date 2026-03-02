import { Injectable, Logger, NotFoundException, Inject } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { REDIS_CLIENT } from '../redis/redis.module';
import IORedis from 'ioredis';

const CACHE_KEY = 'features:flags';
const CACHE_TTL = 60; // seconds

const DEFAULT_FLAGS: Array<{ key: string; name: string; description: string; isEnabled: boolean }> = [
  { key: 'maintenance_mode', name: 'Maintenance Mode', description: 'Put the storefront in maintenance mode', isEnabled: false },
  { key: 'new_checkout', name: 'New Checkout Flow', description: 'Enable the redesigned checkout experience', isEnabled: false },
  { key: 'loyalty_points', name: 'Loyalty Points', description: 'Enable loyalty points system', isEnabled: false },
  { key: 'back_in_stock', name: 'Back In Stock Alerts', description: 'Allow customers to subscribe for back-in-stock notifications', isEnabled: true },
  { key: 'reviews_enabled', name: 'Product Reviews', description: 'Enable customer reviews on products', isEnabled: true },
  { key: 'chat_enabled', name: 'Live Chat', description: 'Enable the live chat widget', isEnabled: false },
];

@Injectable()
export class FeaturesService {
  private readonly logger = new Logger(FeaturesService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(REDIS_CLIENT) private readonly redis: IORedis,
  ) {}

  /**
   * Ensures default flags exist in DB if the table is empty.
   */
  async seedDefaults(): Promise<void> {
    for (const flag of DEFAULT_FLAGS) {
      await this.prisma.featureFlag.upsert({
        where: { key: flag.key },
        create: { key: flag.key, name: flag.name, description: flag.description, isEnabled: flag.isEnabled },
        update: {},
      });
    }
  }

  /**
   * Returns a flat map { [key]: boolean } for public consumption.
   * Caches result in Redis for CACHE_TTL seconds.
   */
  async getPublicConfig(): Promise<Record<string, boolean>> {
    try {
      const cached = await this.redis.get(CACHE_KEY);
      if (cached) {
        return JSON.parse(cached) as Record<string, boolean>;
      }
    } catch (err) {
      this.logger.warn(`Redis read failed for feature flags: ${(err as Error).message}`);
    }

    const flags = await this.prisma.featureFlag.findMany({
      select: { key: true, isEnabled: true },
    });

    const map: Record<string, boolean> = {};
    for (const f of flags) {
      map[f.key] = f.isEnabled;
    }

    // Set defaults for any missing keys
    for (const def of DEFAULT_FLAGS) {
      if (!(def.key in map)) {
        map[def.key] = def.isEnabled;
      }
    }

    try {
      await this.redis.set(CACHE_KEY, JSON.stringify(map), 'EX', CACHE_TTL);
    } catch (err) {
      this.logger.warn(`Redis write failed for feature flags: ${(err as Error).message}`);
    }

    return map;
  }

  /**
   * Returns full flag records for admin view.
   */
  async findAll() {
    const flags = await this.prisma.featureFlag.findMany({
      orderBy: { key: 'asc' },
    });
    return flags;
  }

  /**
   * Updates a single flag's enabled state and busts the cache.
   */
  async update(key: string, enabled: boolean) {
    const flag = await this.prisma.featureFlag.findUnique({ where: { key } });
    if (!flag) {
      throw new NotFoundException(`Feature flag "${key}" not found`);
    }

    const updated = await this.prisma.featureFlag.update({
      where: { key },
      data: { isEnabled: enabled },
    });

    // Bust cache
    try {
      await this.redis.del(CACHE_KEY);
    } catch (err) {
      this.logger.warn(`Failed to bust feature flag cache: ${(err as Error).message}`);
    }

    this.logger.log(`Feature flag "${key}" set to ${enabled}`);
    return updated;
  }
}
