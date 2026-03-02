import { Injectable, Logger, Inject, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { REDIS_CLIENT } from '../redis/redis.module';
import { FraudRiskLevel, FraudAction } from '@prisma/client';
import IORedis from 'ioredis';
import { v4 as uuidv4 } from 'uuid';
import { AddBlacklistDto, BlacklistType } from './dto/fraud.dto';

// Velocity check: max orders per 10 minutes
const VELOCITY_WINDOW_SECONDS = 600;
const VELOCITY_MAX_ORDERS = 5;

// Amount thresholds (in cents or smallest currency unit)
const AMOUNT_MEDIUM_THRESHOLD = 50000;  // 500.00
const AMOUNT_HIGH_THRESHOLD = 200000;   // 2000.00

export interface FraudCheckResult {
  riskLevel: FraudRiskLevel;
  riskScore: number;
  reasons: string[];
  action: FraudAction;
}

export interface BlacklistEntry {
  id: string;
  type: BlacklistType;
  value: string;
  reason?: string;
  createdAt: string;
}

// Default fraud rules stored in Redis hash `fraud:rules`
const DEFAULT_RULES = [
  {
    id: 'rule_ip_blacklist',
    name: 'IP Blacklist',
    description: 'Block orders from blacklisted IPs',
    ruleType: 'IP_BLACKLIST',
    isActive: true,
    action: FraudAction.BLOCK,
  },
  {
    id: 'rule_email_blacklist',
    name: 'Email Blacklist',
    description: 'Block orders from blacklisted email addresses',
    ruleType: 'EMAIL_BLACKLIST',
    isActive: true,
    action: FraudAction.BLOCK,
  },
  {
    id: 'rule_velocity',
    name: 'Order Velocity',
    description: `Block if more than ${VELOCITY_MAX_ORDERS} orders in ${VELOCITY_WINDOW_SECONDS / 60} minutes`,
    ruleType: 'VELOCITY',
    isActive: true,
    action: FraudAction.BLOCK,
  },
  {
    id: 'rule_amount_medium',
    name: 'Medium Amount Threshold',
    description: 'Flag orders over $500 for review',
    ruleType: 'AMOUNT_THRESHOLD_MEDIUM',
    isActive: true,
    action: FraudAction.REVIEW,
  },
  {
    id: 'rule_amount_high',
    name: 'High Amount Threshold',
    description: 'Block or heavily review orders over $2000',
    ruleType: 'AMOUNT_THRESHOLD_HIGH',
    isActive: true,
    action: FraudAction.REVIEW,
  },
];

@Injectable()
export class FraudService {
  private readonly logger = new Logger(FraudService.name);

  private readonly REDIS_IP_BLACKLIST = 'fraud:blacklist:ip';
  private readonly REDIS_EMAIL_BLACKLIST = 'fraud:blacklist:email';
  private readonly REDIS_BLACKLIST_META = 'fraud:blacklist:meta';
  private readonly REDIS_RULES_KEY = 'fraud:rules';

  constructor(
    private readonly prisma: PrismaService,
    @Inject(REDIS_CLIENT) private readonly redis: IORedis,
  ) {}

  // ─── RULES ────────────────────────────────────────────────────────────

  async getRules() {
    try {
      const rulesJson = await this.redis.get(this.REDIS_RULES_KEY);
      if (rulesJson) {
        return JSON.parse(rulesJson) as typeof DEFAULT_RULES;
      }
    } catch {
      // fall through to defaults
    }
    await this.seedDefaultRules();
    return DEFAULT_RULES;
  }

  private async seedDefaultRules(): Promise<void> {
    try {
      await this.redis.set(this.REDIS_RULES_KEY, JSON.stringify(DEFAULT_RULES));
    } catch (err) {
      this.logger.warn(`Failed to seed default fraud rules: ${(err as Error).message}`);
    }
  }

  async updateRule(ruleId: string, enabled: boolean) {
    const rules = await this.getRules();
    const ruleIndex = rules.findIndex((r) => r.id === ruleId);
    if (ruleIndex === -1) {
      throw new NotFoundException(`Fraud rule "${ruleId}" not found`);
    }
    rules[ruleIndex].isActive = enabled;
    await this.redis.set(this.REDIS_RULES_KEY, JSON.stringify(rules));
    this.logger.log(`Fraud rule ${ruleId} set to enabled=${enabled}`);
    return rules[ruleIndex];
  }

  // ─── BLACKLIST ─────────────────────────────────────────────────────────

  async getBlacklist(): Promise<BlacklistEntry[]> {
    try {
      const members = await this.redis.smembers(this.REDIS_IP_BLACKLIST);
      const emailMembers = await this.redis.smembers(this.REDIS_EMAIL_BLACKLIST);

      const entries: BlacklistEntry[] = [];

      for (const ip of members) {
        const meta = await this.redis.hget(this.REDIS_BLACKLIST_META, `ip:${ip}`);
        const parsed = meta ? (JSON.parse(meta) as BlacklistEntry) : null;
        entries.push(
          parsed ?? {
            id: `ip:${ip}`,
            type: BlacklistType.IP,
            value: ip,
            createdAt: new Date().toISOString(),
          },
        );
      }

      for (const email of emailMembers) {
        const meta = await this.redis.hget(this.REDIS_BLACKLIST_META, `email:${email}`);
        const parsed = meta ? (JSON.parse(meta) as BlacklistEntry) : null;
        entries.push(
          parsed ?? {
            id: `email:${email}`,
            type: BlacklistType.EMAIL,
            value: email,
            createdAt: new Date().toISOString(),
          },
        );
      }

      return entries.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
    } catch (err) {
      this.logger.error(`Failed to get blacklist: ${(err as Error).message}`);
      return [];
    }
  }

  async addToBlacklist(dto: AddBlacklistDto): Promise<BlacklistEntry> {
    const id = uuidv4();
    const entry: BlacklistEntry = {
      id,
      type: dto.type,
      value: dto.value,
      reason: dto.reason,
      createdAt: new Date().toISOString(),
    };

    const redisKey =
      dto.type === BlacklistType.IP ? this.REDIS_IP_BLACKLIST : this.REDIS_EMAIL_BLACKLIST;
    const metaField =
      dto.type === BlacklistType.IP ? `ip:${dto.value}` : `email:${dto.value}`;

    await this.redis.sadd(redisKey, dto.value);
    await this.redis.hset(this.REDIS_BLACKLIST_META, metaField, JSON.stringify(entry));

    // Also persist IP to DB (IpBlacklist model)
    if (dto.type === BlacklistType.IP) {
      try {
        await this.prisma.ipBlacklist.upsert({
          where: { ip: dto.value },
          create: { ip: dto.value, reason: dto.reason ?? null },
          update: { reason: dto.reason ?? null },
        });
      } catch (err) {
        this.logger.warn(`Failed to persist IP blacklist to DB: ${(err as Error).message}`);
      }
    }

    this.logger.log(`Added ${dto.type} to blacklist: ${dto.value}`);
    return entry;
  }

  async removeFromBlacklist(entryId: string): Promise<void> {
    // entryId format: "ip:1.2.3.4" or "email:user@example.com"
    const [type, ...valueParts] = entryId.split(':');
    const value = valueParts.join(':');

    if (!type || !value) {
      throw new NotFoundException('Invalid blacklist entry ID format');
    }

    if (type === 'ip') {
      await this.redis.srem(this.REDIS_IP_BLACKLIST, value);
      await this.redis.hdel(this.REDIS_BLACKLIST_META, `ip:${value}`);
      try {
        await this.prisma.ipBlacklist.deleteMany({ where: { ip: value } });
      } catch {
        // ignore if not in DB
      }
    } else if (type === 'email') {
      await this.redis.srem(this.REDIS_EMAIL_BLACKLIST, value);
      await this.redis.hdel(this.REDIS_BLACKLIST_META, `email:${value}`);
    } else {
      throw new NotFoundException('Invalid blacklist type');
    }

    this.logger.log(`Removed from blacklist: ${entryId}`);
  }

  // ─── FRAUD CHECK ───────────────────────────────────────────────────────

  async checkOrder(
    orderId: string,
    userId: string,
    ip?: string,
    email?: string,
    amount?: number,
  ): Promise<FraudCheckResult> {
    const reasons: string[] = [];
    let riskScore = 0;

    const rules = await this.getRules();
    const activeRuleIds = new Set(rules.filter((r) => r.isActive).map((r) => r.id));

    // Check 1: IP blacklist
    if (ip && activeRuleIds.has('rule_ip_blacklist')) {
      const isBlacklisted = await this.redis.sismember(this.REDIS_IP_BLACKLIST, ip);
      if (isBlacklisted === 1) {
        reasons.push(`IP address ${ip} is blacklisted`);
        riskScore = 100;
      }
    }

    // Check 2: Email blacklist
    if (email && activeRuleIds.has('rule_email_blacklist')) {
      const isBlacklisted = await this.redis.sismember(this.REDIS_EMAIL_BLACKLIST, email);
      if (isBlacklisted === 1) {
        reasons.push(`Email ${email} is blacklisted`);
        riskScore = 100;
      }
    }

    // Check 3: Velocity - count orders in last 10 min for userId and IP
    if (activeRuleIds.has('rule_velocity')) {
      const userVelocityKey = `fraud:velocity:user:${userId}`;
      const ipVelocityKey = ip ? `fraud:velocity:ip:${ip}` : null;

      const [userCount, ipCount] = await Promise.all([
        this.incrementVelocity(userVelocityKey),
        ipVelocityKey ? this.incrementVelocity(ipVelocityKey) : Promise.resolve(0),
      ]);

      if (userCount > VELOCITY_MAX_ORDERS) {
        reasons.push(`High order velocity for user (${userCount} orders in 10 min)`);
        riskScore = Math.max(riskScore, 80);
      }

      if (ipCount > VELOCITY_MAX_ORDERS) {
        reasons.push(`High order velocity for IP ${ip} (${ipCount} orders in 10 min)`);
        riskScore = Math.max(riskScore, 80);
      }
    }

    // Check 4: Amount thresholds
    if (amount !== undefined) {
      if (activeRuleIds.has('rule_amount_high') && amount >= AMOUNT_HIGH_THRESHOLD) {
        reasons.push(`High order amount: ${amount} (threshold: ${AMOUNT_HIGH_THRESHOLD})`);
        riskScore = Math.max(riskScore, 70);
      } else if (activeRuleIds.has('rule_amount_medium') && amount >= AMOUNT_MEDIUM_THRESHOLD) {
        reasons.push(`Elevated order amount: ${amount} (threshold: ${AMOUNT_MEDIUM_THRESHOLD})`);
        riskScore = Math.max(riskScore, 40);
      }
    }

    // Determine risk level and action
    let riskLevel: FraudRiskLevel;
    let action: FraudAction;

    if (riskScore >= 100) {
      riskLevel = FraudRiskLevel.BLOCKED;
      action = FraudAction.BLOCK;
    } else if (riskScore >= 70) {
      riskLevel = FraudRiskLevel.HIGH;
      action = FraudAction.REVIEW;
    } else if (riskScore >= 40) {
      riskLevel = FraudRiskLevel.MEDIUM;
      action = FraudAction.REVIEW;
    } else {
      riskLevel = FraudRiskLevel.LOW;
      action = FraudAction.ALLOW;
    }

    // Persist fraud event to DB
    try {
      await this.prisma.fraudEvent.create({
        data: {
          orderId: orderId || null,
          customerId: userId || null,
          email: email || null,
          ipAddress: ip || null,
          riskLevel,
          riskScore,
          triggers: reasons,
          action,
        },
      });
    } catch (err) {
      this.logger.warn(`Failed to persist fraud event: ${(err as Error).message}`);
    }

    return { riskLevel, riskScore, reasons, action };
  }

  private async incrementVelocity(key: string): Promise<number> {
    try {
      const count = await this.redis.incr(key);
      if (count === 1) {
        await this.redis.expire(key, VELOCITY_WINDOW_SECONDS);
      }
      return count;
    } catch {
      return 0;
    }
  }

  // ─── EVENTS ────────────────────────────────────────────────────────────

  async getRecentEvents(limit = 50) {
    return this.prisma.fraudEvent.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }
}
