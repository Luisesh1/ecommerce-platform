import { createHmac } from 'crypto';

export interface MercadoPagoPreference {
  id: string;
  init_point: string;
  sandbox_init_point: string;
}

export interface MercadoPagoPayment {
  id: number;
  status: string;
  status_detail: string;
  transaction_amount: number;
  currency_id: string;
  order?: { id?: string };
  external_reference?: string;
}

export interface MercadoPagoRefund {
  id: number;
  payment_id: number;
  amount: number;
  status: string;
}

export interface MercadoPagoWebhookEvent {
  type: string;
  action?: string;
  data?: { id?: string | number };
  resource?: string;
  topic?: string;
}

export class MercadoPagoProvider {
  private readonly baseUrl = 'https://api.mercadopago.com';

  constructor(
    private readonly accessToken: string,
    private readonly publicKey: string,
  ) {}

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
        'X-Idempotency-Key': `${Date.now()}-${Math.random()}`,
      },
      ...(body !== undefined && { body: JSON.stringify(body) }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`MercadoPago API error ${res.status}: ${text}`);
    }

    return res.json() as Promise<T>;
  }

  /**
   * Creates a MercadoPago Preference (checkout intent).
   * amount must be in the base currency unit (e.g. pesos, not centavos).
   */
  async createPaymentIntent(
    amount: number,
    currency: string,
    metadata: Record<string, string> = {},
  ): Promise<MercadoPagoPreference> {
    const body = {
      items: [
        {
          id: metadata.orderId ?? 'order',
          title: metadata.description ?? 'Compra',
          quantity: 1,
          unit_price: amount / 100, // MercadoPago uses full currency units
          currency_id: currency.toUpperCase(),
        },
      ],
      external_reference: metadata.orderId,
      metadata,
      back_urls: {
        success: metadata.successUrl ?? '',
        failure: metadata.failureUrl ?? '',
        pending: metadata.pendingUrl ?? '',
      },
      auto_return: 'approved',
    };

    return this.request<MercadoPagoPreference>('POST', '/checkout/preferences', body);
  }

  /**
   * Retrieves a payment by ID to verify its status.
   */
  async confirm(paymentId: string): Promise<MercadoPagoPayment> {
    return this.request<MercadoPagoPayment>('GET', `/v1/payments/${paymentId}`);
  }

  /**
   * Creates a full or partial refund for a payment.
   */
  async refund(paymentId: string, amount?: number): Promise<MercadoPagoRefund> {
    const body = amount !== undefined ? { amount: amount / 100 } : {};
    return this.request<MercadoPagoRefund>(
      'POST',
      `/v1/payments/${paymentId}/refunds`,
      body,
    );
  }

  /**
   * Verifies MercadoPago webhook x-signature header and returns parsed event.
   * Throws if signature is invalid.
   * Format: "ts=<timestamp>,v1=<hmac>"
   */
  handleWebhook(
    payload: Buffer | string,
    xSignature: string,
    xRequestId: string,
    secret: string,
  ): MercadoPagoWebhookEvent {
    // Parse x-signature header: ts=<timestamp>,v1=<hash>
    const parts = Object.fromEntries(
      xSignature.split(',').map((part) => {
        const [k, v] = part.split('=');
        return [k.trim(), v?.trim() ?? ''];
      }),
    );

    const ts = parts['ts'];
    const v1 = parts['v1'];

    if (!ts || !v1) {
      throw new Error('Invalid x-signature header format');
    }

    // MercadoPago signed template: "id:<dataId>;request-id:<requestId>;ts:<timestamp>;"
    const rawPayload =
      typeof payload === 'string' ? payload : payload.toString('utf8');

    let dataId: string | undefined;
    try {
      const parsed = JSON.parse(rawPayload) as MercadoPagoWebhookEvent;
      dataId = String(parsed.data?.id ?? '');
    } catch {
      dataId = '';
    }

    const manifest = `id:${dataId};request-id:${xRequestId};ts:${ts};`;
    const expectedSig = createHmac('sha256', secret)
      .update(manifest)
      .digest('hex');

    if (expectedSig !== v1) {
      throw new Error('MercadoPago webhook signature verification failed');
    }

    return JSON.parse(
      typeof payload === 'string' ? payload : payload.toString('utf8'),
    ) as MercadoPagoWebhookEvent;
  }

  /**
   * Returns public configuration for the frontend SDK.
   */
  getPublicConfig(): { public_key: string } {
    return { public_key: this.publicKey };
  }

  /**
   * Tests connectivity by calling /users/me with the access token.
   */
  async testConnection(): Promise<{ id: number; email: string }> {
    return this.request<{ id: number; email: string }>('GET', '/users/me');
  }
}
