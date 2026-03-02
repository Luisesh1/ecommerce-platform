import Stripe from 'stripe';

export class StripeProvider {
  private readonly stripe: Stripe;

  constructor(secretKey: string) {
    this.stripe = new Stripe(secretKey, {
      apiVersion: '2023-10-16' as Stripe.LatestApiVersion,
    });
  }

  /**
   * Creates a PaymentIntent with automatic payment methods enabled.
   * Amount should be in the smallest currency unit (e.g. cents for USD/MXN).
   */
  async createPaymentIntent(
    amount: number,
    currency: string,
    metadata: Record<string, string> = {},
  ): Promise<Stripe.PaymentIntent> {
    return this.stripe.paymentIntents.create({
      amount,
      currency: currency.toLowerCase(),
      automatic_payment_methods: { enabled: true },
      metadata,
    });
  }

  /**
   * Confirms a PaymentIntent server-side (useful for 3DS flows or when the
   * payment_method is already attached).
   */
  async confirmPaymentIntent(
    paymentIntentId: string,
  ): Promise<Stripe.PaymentIntent> {
    return this.stripe.paymentIntents.confirm(paymentIntentId);
  }

  /**
   * Creates a refund for a PaymentIntent.
   * If amount is omitted, a full refund is created.
   */
  async createRefund(
    paymentIntentId: string,
    amount?: number,
  ): Promise<Stripe.Refund> {
    return this.stripe.refunds.create({
      payment_intent: paymentIntentId,
      ...(amount !== undefined && { amount }),
    });
  }

  /**
   * Constructs and validates a Stripe webhook event from the raw payload.
   * Throws a Stripe.errors.StripeSignatureVerificationError on failure.
   */
  constructWebhookEvent(
    payload: Buffer,
    signature: string,
    secret: string,
  ): Stripe.Event {
    return this.stripe.webhooks.constructEvent(payload, signature, secret);
  }

  /**
   * Retrieves a PaymentIntent by ID.
   */
  async getPaymentIntent(paymentIntentId: string): Promise<Stripe.PaymentIntent> {
    return this.stripe.paymentIntents.retrieve(paymentIntentId);
  }

  /**
   * Creates a Stripe Customer.
   */
  async createCustomer(
    email: string,
    metadata?: Record<string, string>,
  ): Promise<Stripe.Customer> {
    return this.stripe.customers.create({ email, metadata });
  }
}
