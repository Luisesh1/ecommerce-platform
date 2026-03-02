export interface PayPalOrder {
  id: string;
  status: string;
  links: Array<{ href: string; rel: string; method: string }>;
}

export interface PayPalCapture {
  id: string;
  status: string;
  purchase_units: Array<{
    payments?: {
      captures?: Array<{ id: string; status: string; amount: { value: string; currency_code: string } }>;
    };
  }>;
}

export interface PayPalRefund {
  id: string;
  status: string;
  amount?: { value: string; currency_code: string };
}

export class PayPalProvider {
  private readonly baseUrl: string;

  constructor(
    private readonly clientId: string,
    private readonly clientSecret: string,
    sandbox = false,
  ) {
    this.baseUrl = sandbox
      ? 'https://api-m.sandbox.paypal.com'
      : 'https://api-m.paypal.com';
  }

  /** Obtain OAuth2 access token from PayPal */
  private async getAccessToken(): Promise<string> {
    const credentials = Buffer.from(
      `${this.clientId}:${this.clientSecret}`,
    ).toString('base64');

    const res = await fetch(`${this.baseUrl}/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`PayPal auth error ${res.status}: ${text}`);
    }

    const data = (await res.json()) as { access_token: string };
    return data.access_token;
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
    extraHeaders?: Record<string, string>,
  ): Promise<T> {
    const token = await this.getAccessToken();

    const res = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'PayPal-Request-Id': `${Date.now()}-${Math.random()}`,
        ...extraHeaders,
      },
      ...(body !== undefined && { body: JSON.stringify(body) }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`PayPal API error ${res.status}: ${text}`);
    }

    // 204 No Content responses have no body
    if (res.status === 204) return {} as T;
    return res.json() as Promise<T>;
  }

  /**
   * Creates a PayPal Order (payment intent equivalent).
   * amount must be in smallest currency unit (cents). PayPal uses decimal strings.
   */
  async createPaymentIntent(
    amount: number,
    currency: string,
    metadata: Record<string, string> = {},
  ): Promise<PayPalOrder> {
    const decimalAmount = (amount / 100).toFixed(2);

    const body = {
      intent: 'CAPTURE',
      purchase_units: [
        {
          reference_id: metadata.orderId ?? 'default',
          custom_id: metadata.orderId,
          description: metadata.description ?? 'Order',
          amount: {
            currency_code: currency.toUpperCase(),
            value: decimalAmount,
          },
        },
      ],
      application_context: {
        return_url: metadata.successUrl ?? 'https://example.com/success',
        cancel_url: metadata.cancelUrl ?? 'https://example.com/cancel',
        brand_name: metadata.brandName ?? 'Ecommerce',
        landing_page: 'BILLING',
        user_action: 'PAY_NOW',
      },
    };

    return this.request<PayPalOrder>('POST', '/v2/checkout/orders', body);
  }

  /**
   * Captures (confirms) an approved PayPal order.
   */
  async confirm(orderId: string): Promise<PayPalCapture> {
    return this.request<PayPalCapture>(
      'POST',
      `/v2/checkout/orders/${orderId}/capture`,
      {},
    );
  }

  /**
   * Refunds a captured payment. amount is in smallest currency unit (cents).
   * If amount is omitted, a full refund is issued.
   */
  async refund(
    captureId: string,
    amount?: number,
    currency?: string,
  ): Promise<PayPalRefund> {
    const body =
      amount !== undefined && currency
        ? {
            amount: {
              value: (amount / 100).toFixed(2),
              currency_code: currency.toUpperCase(),
            },
          }
        : {};

    return this.request<PayPalRefund>(
      'POST',
      `/v2/payments/captures/${captureId}/refund`,
      body,
    );
  }

  /**
   * Verifies PayPal webhook signature using PayPal's verify-webhook-signature API.
   * Returns the parsed event if valid; throws on failure.
   */
  async handleWebhook(
    payload: Buffer | string,
    headers: {
      transmissionId: string;
      transmissionTime: string;
      certUrl: string;
      authAlgo: string;
      transmissionSig: string;
    },
    webhookId: string,
  ): Promise<unknown> {
    const rawBody =
      typeof payload === 'string' ? payload : payload.toString('utf8');

    const verifyBody = {
      transmission_id: headers.transmissionId,
      transmission_time: headers.transmissionTime,
      cert_url: headers.certUrl,
      auth_algo: headers.authAlgo,
      transmission_sig: headers.transmissionSig,
      webhook_id: webhookId,
      webhook_event: JSON.parse(rawBody),
    };

    const result = await this.request<{ verification_status: string }>(
      'POST',
      '/v1/notifications/verify-webhook-signature',
      verifyBody,
    );

    if (result.verification_status !== 'SUCCESS') {
      throw new Error('PayPal webhook signature verification failed');
    }

    return JSON.parse(rawBody);
  }

  /**
   * Returns public configuration for the frontend SDK.
   */
  getPublicConfig(): { client_id: string } {
    return { client_id: this.clientId };
  }

  /**
   * Tests connectivity by obtaining an access token from PayPal.
   */
  async testConnection(): Promise<{ scope: string }> {
    const credentials = Buffer.from(
      `${this.clientId}:${this.clientSecret}`,
    ).toString('base64');

    const res = await fetch(`${this.baseUrl}/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
    });

    if (!res.ok) {
      throw new Error(`PayPal connection test failed: ${res.status}`);
    }

    return res.json() as Promise<{ scope: string }>;
  }
}
