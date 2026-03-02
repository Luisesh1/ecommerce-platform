import {
  Injectable,
  Logger,
  Inject,
  NotFoundException,
} from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import IORedis from 'ioredis';
import { REDIS_CLIENT } from '../redis/redis.module';

export type TaxMethod = 'INCLUSIVE' | 'EXCLUSIVE';

export interface TaxRate {
  id: string;
  region: string;     // e.g. 'MX', 'MX-CMX', 'US-CA', '*' for global default
  rate: number;       // percentage, e.g. 16 for 16%
  method: TaxMethod;
  enabled: boolean;
}

export interface TaxCalculation {
  subtotal: number;
  tax: number;
  total: number;
  rate: number;
  method: TaxMethod;
  region: string;
}

const TAX_RATES_KEY = 'tax:rates';

@Injectable()
export class TaxService {
  private readonly logger = new Logger(TaxService.name);

  constructor(@Inject(REDIS_CLIENT) private readonly redis: IORedis) {}

  // ── CRUD ───────────────────────────────────────────────────────────────────

  async listRates(): Promise<TaxRate[]> {
    const raw = await this.redis.get(TAX_RATES_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as TaxRate[];
  }

  async createRate(dto: {
    region: string;
    rate: number;
    method: TaxMethod;
    enabled?: boolean;
  }): Promise<TaxRate> {
    const rates = await this.listRates();

    const newRate: TaxRate = {
      id: uuidv4(),
      region: dto.region,
      rate: dto.rate,
      method: dto.method,
      enabled: dto.enabled ?? true,
    };

    rates.push(newRate);
    await this.redis.set(TAX_RATES_KEY, JSON.stringify(rates));
    this.logger.log(`Created tax rate ${newRate.id} for region ${newRate.region}`);
    return newRate;
  }

  async updateRate(
    id: string,
    dto: Partial<Omit<TaxRate, 'id'>>,
  ): Promise<TaxRate> {
    const rates = await this.listRates();
    const idx = rates.findIndex((r) => r.id === id);
    if (idx === -1) throw new NotFoundException(`Tax rate ${id} not found`);

    const updated: TaxRate = { ...rates[idx]!, ...dto, id };
    rates[idx] = updated;
    await this.redis.set(TAX_RATES_KEY, JSON.stringify(rates));
    return updated;
  }

  async deleteRate(id: string): Promise<void> {
    const rates = await this.listRates();
    const idx = rates.findIndex((r) => r.id === id);
    if (idx === -1) throw new NotFoundException(`Tax rate ${id} not found`);

    rates.splice(idx, 1);
    await this.redis.set(TAX_RATES_KEY, JSON.stringify(rates));
    this.logger.log(`Deleted tax rate ${id}`);
  }

  // ── Calculation ────────────────────────────────────────────────────────────

  /**
   * Calculates tax for a given amount and region.
   *
   * Matching priority:
   *   1. Exact region match (e.g. 'MX-CMX')
   *   2. Country-level match (e.g. 'MX')
   *   3. Global wildcard '*'
   *
   * If no rate is found, returns { tax: 0, total: amount }.
   */
  async calculate(amount: number, region: string): Promise<TaxCalculation> {
    const rates = await this.listRates();
    const enabled = rates.filter((r) => r.enabled);

    // Priority lookup
    const matched =
      enabled.find((r) => r.region === region) ??
      enabled.find((r) => r.region === region.split('-')[0]) ??
      enabled.find((r) => r.region === '*');

    if (!matched) {
      return {
        subtotal: amount,
        tax: 0,
        total: amount,
        rate: 0,
        method: 'EXCLUSIVE',
        region,
      };
    }

    const rateDecimal = matched.rate / 100;
    let subtotal: number;
    let tax: number;
    let total: number;

    if (matched.method === 'INCLUSIVE') {
      // Tax is already embedded in the amount
      tax = Math.round(amount - amount / (1 + rateDecimal));
      subtotal = amount - tax;
      total = amount;
    } else {
      // EXCLUSIVE: tax is added on top
      subtotal = amount;
      tax = Math.round(amount * rateDecimal);
      total = amount + tax;
    }

    return { subtotal, tax, total, rate: matched.rate, method: matched.method, region };
  }
}
