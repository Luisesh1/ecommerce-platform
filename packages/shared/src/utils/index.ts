import { createHash, randomBytes } from 'crypto';

export function generateId(prefix?: string): string {
  const id = randomBytes(16).toString('hex');
  return prefix ? `${prefix}_${id}` : id;
}

export function generateOrderNumber(): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `ORD-${timestamp}-${random}`;
}

export function slugify(text: string): string {
  return text
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w-]+/g, '')
    .replace(/--+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '');
}

export function formatCurrency(amount: number, currency = 'MXN', locale = 'es-MX'): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount / 100);
}

export function amountToMinorUnits(amount: number): number {
  return Math.round(amount * 100);
}

export function minorUnitsToAmount(amount: number): number {
  return amount / 100;
}

export function calculateTax(
  subtotal: number,
  taxRate: number,
  inclusive = false,
): { taxAmount: number; netAmount: number } {
  if (inclusive) {
    const netAmount = Math.round(subtotal / (1 + taxRate));
    const taxAmount = subtotal - netAmount;
    return { taxAmount, netAmount };
  }
  const taxAmount = Math.round(subtotal * taxRate);
  return { taxAmount, netAmount: subtotal };
}

export function calculateDiscount(
  amount: number,
  discountType: 'PERCENTAGE' | 'FIXED_AMOUNT',
  discountValue: number,
  maximumDiscount?: number,
): number {
  let discount = 0;
  if (discountType === 'PERCENTAGE') {
    discount = Math.round(amount * (discountValue / 100));
  } else {
    discount = discountValue;
  }
  if (maximumDiscount !== undefined) {
    discount = Math.min(discount, maximumDiscount);
  }
  return Math.min(discount, amount);
}

export function hashString(str: string): string {
  return createHash('sha256').update(str).digest('hex');
}

export function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  const maskedLocal = local.length > 2
    ? `${local[0]}${'*'.repeat(local.length - 2)}${local[local.length - 1]}`
    : `${local[0]}*`;
  return `${maskedLocal}@${domain}`;
}

export function maskCardNumber(cardNumber: string): string {
  return `**** **** **** ${cardNumber.slice(-4)}`;
}

export function isExpired(date: Date): boolean {
  return new Date() > new Date(date);
}

export function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60 * 1000);
}

export function addHours(date: Date, hours: number): Date {
  return new Date(date.getTime() + hours * 60 * 60 * 1000);
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return `${str.slice(0, maxLength - 3)}...`;
}

export function omit<T extends object, K extends keyof T>(obj: T, keys: K[]): Omit<T, K> {
  const result = { ...obj };
  keys.forEach((key) => delete result[key]);
  return result;
}

export function pick<T extends object, K extends keyof T>(obj: T, keys: K[]): Pick<T, K> {
  const result = {} as Pick<T, K>;
  keys.forEach((key) => {
    if (key in obj) result[key] = obj[key];
  });
  return result;
}

export function chunk<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

export function deepDiff(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
): Record<string, { before: unknown; after: unknown }> {
  const diff: Record<string, { before: unknown; after: unknown }> = {};
  const allKeys = new Set([...Object.keys(before), ...Object.keys(after)]);
  for (const key of allKeys) {
    if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) {
      diff[key] = { before: before[key], after: after[key] };
    }
  }
  return diff;
}

export function sanitizeForAudit(
  obj: Record<string, unknown>,
  sensitiveFields = ['password', 'secretKey', 'clientSecret', 'webhookSecret', 'accessToken'],
): Record<string, unknown> {
  const result = { ...obj };
  for (const field of sensitiveFields) {
    if (field in result) {
      result[field] = '[REDACTED]';
    }
  }
  return result;
}

export function parseBoolean(value: string | boolean | undefined, defaultValue = false): boolean {
  if (value === undefined) return defaultValue;
  if (typeof value === 'boolean') return value;
  return value.toLowerCase() === 'true' || value === '1';
}

export function retry<T>(
  fn: () => Promise<T>,
  maxAttempts: number,
  delayMs: number,
): Promise<T> {
  return fn().catch((err) => {
    if (maxAttempts <= 1) throw err;
    return new Promise((resolve) => setTimeout(resolve, delayMs)).then(() =>
      retry(fn, maxAttempts - 1, delayMs * 2),
    );
  });
}
