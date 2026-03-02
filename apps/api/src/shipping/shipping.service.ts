import {
  Injectable,
  Logger,
  Inject,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import IORedis from 'ioredis';
import { REDIS_CLIENT } from '../redis/redis.module';
import {
  CreateShippingZoneDto,
  UpdateShippingZoneDto,
  CreateShippingMethodDto,
  UpdateShippingMethodDto,
  ShippingZone,
  ShippingMethod,
  ShippingMethodType,
} from './dto/shipping.dto';

const ZONES_KEY = 'shipping:zones';
const METHODS_KEY = (zoneId: string) => `shipping:methods:${zoneId}`;

@Injectable()
export class ShippingService {
  private readonly logger = new Logger(ShippingService.name);

  constructor(@Inject(REDIS_CLIENT) private readonly redis: IORedis) {}

  // ── Zones ──────────────────────────────────────────────────────────────────

  async listZones(): Promise<ShippingZone[]> {
    const raw = await this.redis.hgetall(ZONES_KEY);
    return Object.values(raw).map((v) => JSON.parse(v) as ShippingZone);
  }

  async getZone(id: string): Promise<ShippingZone> {
    const raw = await this.redis.hget(ZONES_KEY, id);
    if (!raw) throw new NotFoundException(`Shipping zone ${id} not found`);
    return JSON.parse(raw) as ShippingZone;
  }

  async createZone(dto: CreateShippingZoneDto): Promise<ShippingZone> {
    // If isDefault, unset previous default
    if (dto.isDefault) {
      await this.clearDefaultZone();
    }

    const zone: ShippingZone = {
      id: uuidv4(),
      name: dto.name,
      countries: dto.countries,
      isDefault: dto.isDefault ?? false,
    };

    await this.redis.hset(ZONES_KEY, zone.id, JSON.stringify(zone));
    this.logger.log(`Created shipping zone ${zone.id}: ${zone.name}`);
    return zone;
  }

  async updateZone(id: string, dto: UpdateShippingZoneDto): Promise<ShippingZone> {
    const zone = await this.getZone(id);

    if (dto.isDefault && !zone.isDefault) {
      await this.clearDefaultZone();
    }

    const updated: ShippingZone = {
      ...zone,
      ...(dto.name !== undefined && { name: dto.name }),
      ...(dto.countries !== undefined && { countries: dto.countries }),
      ...(dto.isDefault !== undefined && { isDefault: dto.isDefault }),
    };

    await this.redis.hset(ZONES_KEY, id, JSON.stringify(updated));
    return updated;
  }

  async deleteZone(id: string): Promise<void> {
    const exists = await this.redis.hexists(ZONES_KEY, id);
    if (!exists) throw new NotFoundException(`Shipping zone ${id} not found`);

    // Delete zone and its methods
    await Promise.all([
      this.redis.hdel(ZONES_KEY, id),
      this.redis.del(METHODS_KEY(id)),
    ]);
    this.logger.log(`Deleted shipping zone ${id}`);
  }

  private async clearDefaultZone(): Promise<void> {
    const zones = await this.listZones();
    const previousDefault = zones.find((z) => z.isDefault);
    if (previousDefault) {
      const updated = { ...previousDefault, isDefault: false };
      await this.redis.hset(ZONES_KEY, previousDefault.id, JSON.stringify(updated));
    }
  }

  // ── Methods ────────────────────────────────────────────────────────────────

  async listMethods(zoneId: string): Promise<ShippingMethod[]> {
    await this.getZone(zoneId); // verify zone exists
    const raw = await this.redis.lrange(METHODS_KEY(zoneId), 0, -1);
    return raw.map((v) => JSON.parse(v) as ShippingMethod);
  }

  async createMethod(zoneId: string, dto: CreateShippingMethodDto): Promise<ShippingMethod> {
    await this.getZone(zoneId); // verify zone exists

    const method: ShippingMethod = {
      id: uuidv4(),
      zoneId,
      name: dto.name,
      type: dto.type,
      price: dto.price ?? 0,
      conditions: dto.conditions ?? {},
      enabled: dto.enabled ?? true,
    };

    await this.redis.rpush(METHODS_KEY(zoneId), JSON.stringify(method));
    this.logger.log(`Created shipping method ${method.id} in zone ${zoneId}`);
    return method;
  }

  async updateMethod(
    methodId: string,
    dto: UpdateShippingMethodDto,
  ): Promise<ShippingMethod> {
    // Find the method across all zones
    const zones = await this.listZones();

    for (const zone of zones) {
      const raw = await this.redis.lrange(METHODS_KEY(zone.id), 0, -1);
      const idx = raw.findIndex((v) => {
        const m = JSON.parse(v) as ShippingMethod;
        return m.id === methodId;
      });

      if (idx !== -1) {
        const method = JSON.parse(raw[idx]!) as ShippingMethod;
        const updated: ShippingMethod = {
          ...method,
          ...(dto.name !== undefined && { name: dto.name }),
          ...(dto.type !== undefined && { type: dto.type }),
          ...(dto.price !== undefined && { price: dto.price }),
          ...(dto.conditions !== undefined && { conditions: dto.conditions }),
          ...(dto.enabled !== undefined && { enabled: dto.enabled }),
        };
        // Redis lists don't support in-place updates; use LSET
        await this.redis.lset(METHODS_KEY(zone.id), idx, JSON.stringify(updated));
        return updated;
      }
    }

    throw new NotFoundException(`Shipping method ${methodId} not found`);
  }

  async deleteMethod(methodId: string): Promise<void> {
    const zones = await this.listZones();

    for (const zone of zones) {
      const raw = await this.redis.lrange(METHODS_KEY(zone.id), 0, -1);
      const toRemove = raw.find((v) => {
        const m = JSON.parse(v) as ShippingMethod;
        return m.id === methodId;
      });

      if (toRemove) {
        await this.redis.lrem(METHODS_KEY(zone.id), 1, toRemove);
        this.logger.log(`Deleted shipping method ${methodId}`);
        return;
      }
    }

    throw new NotFoundException(`Shipping method ${methodId} not found`);
  }

  // ── Public: Estimate ───────────────────────────────────────────────────────

  /**
   * Given a postal code / country, cart value, and weight, returns available
   * shipping methods with calculated prices.
   */
  async estimateShipping(params: {
    cp?: string;
    country?: string;
    productId?: string;
    orderValue?: number;
    weightGrams?: number;
  }): Promise<{ methods: Array<{ name: string; type: string; price: number }> }> {
    const zones = await this.listZones();

    // Find the best matching zone
    let matchedZone: ShippingZone | undefined;
    if (params.country) {
      matchedZone = zones.find((z) => z.countries.includes(params.country!));
    }
    if (!matchedZone) {
      matchedZone = zones.find((z) => z.isDefault);
    }
    if (!matchedZone) {
      return { methods: [] };
    }

    const methods = await this.listMethods(matchedZone.id);
    const available = methods
      .filter((m) => m.enabled)
      .map((m) => {
        let price = m.price;

        if (m.type === ShippingMethodType.FREE) {
          price = 0;
          // FREE may have a minimum order value condition
          if (m.conditions['minOrderValue'] !== undefined) {
            const min = Number(m.conditions['minOrderValue']);
            if ((params.orderValue ?? 0) < min) return null; // not eligible
          }
        } else if (m.type === ShippingMethodType.ORDER_VALUE_BASED) {
          if (m.conditions['minOrderValue'] !== undefined) {
            const min = Number(m.conditions['minOrderValue']);
            if ((params.orderValue ?? 0) >= min) {
              price = Number(m.conditions['discountedPrice'] ?? m.price);
            }
          }
        } else if (m.type === ShippingMethodType.WEIGHT_BASED) {
          const weightKg = (params.weightGrams ?? 0) / 1000;
          const ratePerKg = Number(m.conditions['ratePerKg'] ?? 0);
          const basePrice = Number(m.conditions['basePrice'] ?? m.price);
          price = basePrice + ratePerKg * weightKg;
        }
        // FLAT_RATE: price stays as configured

        return { name: m.name, type: m.type, price: Math.round(price) };
      })
      .filter((m) => m !== null);

    return { methods: available };
  }
}
