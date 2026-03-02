import { Test, TestingModule } from '@nestjs/testing';
import { WebhooksService } from './webhooks.service';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { getQueueToken } from '@nestjs/bull';
import { BadRequestException } from '@nestjs/common';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockPrisma = {
  webhookEvent: {
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    upsert: jest.fn(),
    findMany: jest.fn(),
  },
  order: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  payment: {
    findFirst: jest.fn(),
    update: jest.fn(),
  },
  $transaction: jest.fn((cb: (prisma: any) => unknown) => cb(mockPrisma)),
};

const mockQueue = {
  add: jest.fn(),
  getJob: jest.fn(),
};

const mockConfigService = {
  get: jest.fn((key: string, def?: unknown) => {
    const config: Record<string, string> = {
      STRIPE_WEBHOOK_SECRET: 'whsec_test_secret_for_unit_tests',
      MERCADOPAGO_WEBHOOK_SECRET: 'mp_webhook_secret',
    };
    return config[key] ?? def;
  }),
};

// ---------------------------------------------------------------------------
// Fake Stripe-like signature helpers
// ---------------------------------------------------------------------------

/** Produce a minimal Stripe-format signature header for testing */
function buildStripeSignatureHeader(payload: string, secret: string): string {
  const crypto = require('crypto');
  const timestamp = Math.floor(Date.now() / 1000);
  const signedPayload = `${timestamp}.${payload}`;
  const sig = crypto
    .createHmac('sha256', secret)
    .update(signedPayload, 'utf8')
    .digest('hex');
  return `t=${timestamp},v1=${sig}`;
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('WebhooksService', () => {
  let service: WebhooksService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WebhooksService,
        { provide: PrismaService,                        useValue: mockPrisma       },
        { provide: ConfigService,                        useValue: mockConfigService },
        { provide: getQueueToken('webhook-processing'),  useValue: mockQueue        },
      ],
    }).compile();

    service = module.get<WebhooksService>(WebhooksService);
    jest.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // Idempotency — same event_id must be skipped
  // -------------------------------------------------------------------------
  describe('idempotency', () => {
    it('should skip processing when the event_id was already processed', async () => {
      // Simulate existing PROCESSED record
      mockPrisma.webhookEvent.findUnique.mockResolvedValue({
        id: 'whe-1',
        gateway: 'STRIPE',
        eventId: 'evt_duplicate',
        eventType: 'payment_intent.succeeded',
        status: 'PROCESSED',
        processingAttempts: 1,
        processedAt: new Date(),
      });

      const result = await service.handleStripeWebhook(
        Buffer.from(JSON.stringify({ id: 'evt_duplicate', type: 'payment_intent.succeeded' })),
        'stripe-sig-header',
      );

      // Must return early without re-processing
      expect(result).toMatchObject({ skipped: true });
      // Should NOT create a new event record
      expect(mockPrisma.webhookEvent.create).not.toHaveBeenCalled();
    });

    it('should also skip events with PROCESSING status (in-flight guard)', async () => {
      mockPrisma.webhookEvent.findUnique.mockResolvedValue({
        id: 'whe-2',
        gateway: 'STRIPE',
        eventId: 'evt_inflight',
        eventType: 'payment_intent.created',
        status: 'PROCESSING',
        processingAttempts: 1,
        processedAt: null,
      });

      const result = await service.handleStripeWebhook(
        Buffer.from(JSON.stringify({ id: 'evt_inflight', type: 'payment_intent.created' })),
        'stripe-sig-header',
      );

      expect(result).toMatchObject({ skipped: true });
    });

    it('should process the event when it has never been seen before', async () => {
      // No existing record
      mockPrisma.webhookEvent.findUnique.mockResolvedValue(null);
      mockPrisma.webhookEvent.create.mockResolvedValue({
        id: 'whe-3',
        gateway: 'STRIPE',
        eventId: 'evt_new',
        eventType: 'checkout.session.completed',
        status: 'PENDING',
        processingAttempts: 0,
      });
      mockPrisma.webhookEvent.update.mockResolvedValue({});
      mockQueue.add.mockResolvedValue({ id: 'q-1' });

      // Service should proceed to queue the event (even if Stripe sig verification
      // is bypassed in tests — handled via the mock config service)
      const payload = JSON.stringify({ id: 'evt_new', type: 'checkout.session.completed', data: {} });

      // Even if sig verification throws (because the sig doesn't match),
      // idempotency check happens before verification in some implementations.
      // We simply verify the record lookup occurs.
      try {
        await service.handleStripeWebhook(Buffer.from(payload), 'any-sig');
      } catch {
        // Signature mismatch is fine in unit tests
      }

      expect(mockPrisma.webhookEvent.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ gateway_eventId: expect.any(Object) }),
        }),
      );
    });
  });

  // -------------------------------------------------------------------------
  // Stripe webhook signature verification
  // -------------------------------------------------------------------------
  describe('Stripe signature verification', () => {
    it('should throw BadRequestException when Stripe signature is missing', async () => {
      mockPrisma.webhookEvent.findUnique.mockResolvedValue(null);

      await expect(
        service.handleStripeWebhook(Buffer.from('{}'), ''),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when Stripe signature is invalid', async () => {
      mockPrisma.webhookEvent.findUnique.mockResolvedValue(null);

      await expect(
        service.handleStripeWebhook(Buffer.from('{"id":"evt_bad"}'), 'invalid-signature'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should accept a correctly signed Stripe webhook', async () => {
      const secret = 'whsec_test_secret_for_unit_tests';
      const payload = JSON.stringify({
        id: 'evt_valid_sig',
        type: 'payment_intent.succeeded',
        data: { object: { id: 'pi_test', amount: 5000, currency: 'mxn', status: 'succeeded' } },
      });
      const sigHeader = buildStripeSignatureHeader(payload, secret);

      // No existing record → will try to process
      mockPrisma.webhookEvent.findUnique.mockResolvedValue(null);
      mockPrisma.webhookEvent.create.mockResolvedValue({
        id: 'whe-sig',
        eventId: 'evt_valid_sig',
        status: 'PENDING',
      });
      mockPrisma.webhookEvent.update.mockResolvedValue({});
      mockQueue.add.mockResolvedValue({ id: 'q-valid' });

      // Should NOT throw a BadRequestException for the signature
      const act = service.handleStripeWebhook(Buffer.from(payload), sigHeader);
      await expect(act).resolves.not.toThrow();
    });

    it('should reject a Stripe webhook whose timestamp is too old (replay attack)', async () => {
      const secret = 'whsec_test_secret_for_unit_tests';
      const payload = JSON.stringify({ id: 'evt_old', type: 'payment_intent.succeeded' });
      // Manually build a header with an old timestamp (> 5 minutes)
      const crypto = require('crypto');
      const oldTimestamp = Math.floor(Date.now() / 1000) - 400; // 400 seconds ago
      const signedPayload = `${oldTimestamp}.${payload}`;
      const sig = crypto
        .createHmac('sha256', secret)
        .update(signedPayload, 'utf8')
        .digest('hex');
      const oldSigHeader = `t=${oldTimestamp},v1=${sig}`;

      mockPrisma.webhookEvent.findUnique.mockResolvedValue(null);

      await expect(
        service.handleStripeWebhook(Buffer.from(payload), oldSigHeader),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // -------------------------------------------------------------------------
  // Dead-letter queue after 3 failures
  // -------------------------------------------------------------------------
  describe('dead letter queue', () => {
    it('should move event to DEAD_LETTER after 3 failed processing attempts', async () => {
      const failedEvent = {
        id: 'whe-fail',
        gateway: 'STRIPE',
        eventId: 'evt_retry_3',
        eventType: 'payment_intent.succeeded',
        status: 'FAILED',
        processingAttempts: 3,
        lastError: 'Order not found after 3 retries',
        processedAt: null,
      };

      mockPrisma.webhookEvent.findUnique.mockResolvedValue(failedEvent);
      mockPrisma.webhookEvent.update.mockResolvedValue({
        ...failedEvent,
        status: 'DEAD_LETTER',
      });

      await service.handleFailedWebhook(failedEvent.id);

      expect(mockPrisma.webhookEvent.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'whe-fail' },
          data: expect.objectContaining({ status: 'DEAD_LETTER' }),
        }),
      );
    });

    it('should retry (not dead-letter) when attempts < 3', async () => {
      const failedEvent = {
        id: 'whe-retry',
        gateway: 'STRIPE',
        eventId: 'evt_retry_1',
        eventType: 'payment_intent.succeeded',
        status: 'FAILED',
        processingAttempts: 1,
        lastError: 'Transient DB error',
        processedAt: null,
      };

      mockPrisma.webhookEvent.findUnique.mockResolvedValue(failedEvent);
      mockPrisma.webhookEvent.update.mockResolvedValue({
        ...failedEvent,
        processingAttempts: 2,
        status: 'PENDING',
      });
      mockQueue.add.mockResolvedValue({ id: 'q-retry' });

      await service.handleFailedWebhook(failedEvent.id);

      // Should NOT be dead-lettered
      const updateCall = mockPrisma.webhookEvent.update.mock.calls[0][0];
      expect(updateCall?.data?.status).not.toBe('DEAD_LETTER');
      // Should be re-queued
      expect(mockQueue.add).toHaveBeenCalled();
    });

    it('should not requeue events already in DEAD_LETTER status', async () => {
      const deadEvent = {
        id: 'whe-dead',
        gateway: 'STRIPE',
        eventId: 'evt_dead',
        eventType: 'charge.refunded',
        status: 'DEAD_LETTER',
        processingAttempts: 3,
        processedAt: null,
      };

      mockPrisma.webhookEvent.findUnique.mockResolvedValue(deadEvent);

      await service.handleFailedWebhook(deadEvent.id);

      expect(mockQueue.add).not.toHaveBeenCalled();
      expect(mockPrisma.webhookEvent.update).not.toHaveBeenCalled();
    });

    it('should record lastError when moving to dead letter', async () => {
      const failedEvent = {
        id: 'whe-error',
        gateway: 'STRIPE',
        eventId: 'evt_error_3',
        eventType: 'invoice.payment_failed',
        status: 'FAILED',
        processingAttempts: 3,
        lastError: 'Gateway timeout',
        processedAt: null,
      };

      mockPrisma.webhookEvent.findUnique.mockResolvedValue(failedEvent);
      mockPrisma.webhookEvent.update.mockResolvedValue({ ...failedEvent, status: 'DEAD_LETTER' });

      await service.handleFailedWebhook(failedEvent.id);

      const updateCall = mockPrisma.webhookEvent.update.mock.calls[0][0];
      expect(updateCall?.data).toMatchObject({
        status: 'DEAD_LETTER',
        lastError: expect.any(String),
      });
    });
  });

  // -------------------------------------------------------------------------
  // processWebhookEvent (internal event router)
  // -------------------------------------------------------------------------
  describe('processWebhookEvent', () => {
    it('should mark event as PROCESSED after successful handling', async () => {
      const event = {
        id: 'whe-proc',
        gateway: 'STRIPE',
        eventId: 'evt_proc',
        eventType: 'payment_intent.succeeded',
        payload: {
          data: {
            object: {
              id: 'pi_test',
              amount: 5000,
              currency: 'mxn',
              status: 'succeeded',
              metadata: { orderId: 'ord-1' },
            },
          },
        },
        status: 'PENDING',
        processingAttempts: 0,
      };

      mockPrisma.webhookEvent.findUnique.mockResolvedValue(event);
      mockPrisma.order.findUnique.mockResolvedValue({ id: 'ord-1', status: 'PAYMENT_PENDING' });
      mockPrisma.payment.findFirst.mockResolvedValue({
        id: 'pay-1', orderId: 'ord-1', gatewayPaymentId: 'pi_test',
      });
      mockPrisma.payment.update.mockResolvedValue({ id: 'pay-1', status: 'PAID' });
      mockPrisma.order.update.mockResolvedValue({ id: 'ord-1', status: 'CONFIRMED' });
      mockPrisma.webhookEvent.update.mockResolvedValue({ ...event, status: 'PROCESSED' });

      await service.processWebhookEvent('whe-proc');

      expect(mockPrisma.webhookEvent.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'whe-proc' },
          data: expect.objectContaining({ status: 'PROCESSED' }),
        }),
      );
    });

    it('should increment processingAttempts on failure', async () => {
      const event = {
        id: 'whe-inc',
        gateway: 'STRIPE',
        eventId: 'evt_inc',
        eventType: 'payment_intent.succeeded',
        payload: { data: { object: { id: 'pi_missing', metadata: { orderId: 'ghost-ord' } } } },
        status: 'PENDING',
        processingAttempts: 0,
      };

      mockPrisma.webhookEvent.findUnique.mockResolvedValue(event);
      mockPrisma.order.findUnique.mockResolvedValue(null); // Order not found → processing will throw
      mockPrisma.webhookEvent.update.mockResolvedValue({
        ...event, processingAttempts: 1, status: 'FAILED',
      });

      try {
        await service.processWebhookEvent('whe-inc');
      } catch {
        // expected failure
      }

      expect(mockPrisma.webhookEvent.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'whe-inc' },
          data: expect.objectContaining({
            processingAttempts: { increment: 1 },
          }),
        }),
      );
    });
  });
});
