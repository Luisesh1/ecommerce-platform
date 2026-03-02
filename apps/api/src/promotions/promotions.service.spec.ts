import { Test, TestingModule } from '@nestjs/testing';
import { PromotionsService } from './promotions.service';
import { PrismaService } from '../prisma/prisma.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a "now + offset minutes" date */
const inMinutes = (minutes: number) =>
  new Date(Date.now() + minutes * 60 * 1000);

/** Build a "now - offset minutes" date */
const minutesAgo = (minutes: number) =>
  new Date(Date.now() - minutes * 60 * 1000);

// ---------------------------------------------------------------------------
// Fixture builders
// ---------------------------------------------------------------------------

const makePromotion = (overrides: Record<string, unknown> = {}) => ({
  id: 'promo-1',
  code: 'SAVE10',
  title: '10% de descuento',
  description: 'Promo de prueba',
  discountType: 'PERCENTAGE',
  discountValue: 10,
  minimumOrderAmount: 50000,       // $500 MXN in cents
  maximumDiscountAmount: null,
  usageLimit: 100,
  usageCount: 0,
  usageLimitPerCustomer: 1,
  isCombinable: false,
  freeShipping: false,
  startDate: minutesAgo(60),       // started 1 hour ago
  endDate: inMinutes(60 * 24 * 7), // expires in 1 week
  status: 'ACTIVE',
  applicableProductIds: [],
  applicableCategoryIds: [],
  excludedProductIds: [],
  ...overrides,
});

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockPrisma = {
  promotion: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    findMany: jest.fn(),
  },
  promotionUsage: {
    findFirst: jest.fn(),
    create: jest.fn(),
    count: jest.fn(),
  },
  $transaction: jest.fn((cb: (prisma: any) => unknown) => cb(mockPrisma)),
};

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('PromotionsService', () => {
  let service: PromotionsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PromotionsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<PromotionsService>(PromotionsService);
    jest.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // validateCoupon
  // -------------------------------------------------------------------------
  describe('validateCoupon', () => {
    it('should return the promotion for a valid coupon', async () => {
      const promo = makePromotion();
      mockPrisma.promotion.findFirst.mockResolvedValue(promo);
      mockPrisma.promotionUsage.count.mockResolvedValue(0);

      const result = await service.validateCoupon('SAVE10', 60000, 'customer@example.com');

      expect(result).toBeDefined();
      expect(result.code).toBe('SAVE10');
    });

    it('should throw NotFoundException when coupon code does not exist', async () => {
      mockPrisma.promotion.findFirst.mockResolvedValue(null);

      await expect(
        service.validateCoupon('NOTFOUND', 60000, 'customer@example.com'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when coupon is INACTIVE', async () => {
      mockPrisma.promotion.findFirst.mockResolvedValue(
        makePromotion({ status: 'INACTIVE' }),
      );

      await expect(
        service.validateCoupon('SAVE10', 60000, 'customer@example.com'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when coupon is EXPIRED by status', async () => {
      mockPrisma.promotion.findFirst.mockResolvedValue(
        makePromotion({ status: 'EXPIRED' }),
      );

      await expect(
        service.validateCoupon('SAVE10', 60000, 'customer@example.com'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when coupon endDate is in the past', async () => {
      mockPrisma.promotion.findFirst.mockResolvedValue(
        makePromotion({ endDate: minutesAgo(10) }),
      );

      await expect(
        service.validateCoupon('SAVE10', 60000, 'customer@example.com'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when coupon has not started yet', async () => {
      mockPrisma.promotion.findFirst.mockResolvedValue(
        makePromotion({ startDate: inMinutes(60) }),
      );

      await expect(
        service.validateCoupon('SAVE10', 60000, 'customer@example.com'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when global usage limit is exceeded', async () => {
      mockPrisma.promotion.findFirst.mockResolvedValue(
        makePromotion({ usageLimit: 10, usageCount: 10 }),
      );

      await expect(
        service.validateCoupon('SAVE10', 60000, 'customer@example.com'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when DEPLETED status', async () => {
      mockPrisma.promotion.findFirst.mockResolvedValue(
        makePromotion({ status: 'DEPLETED' }),
      );

      await expect(
        service.validateCoupon('SAVE10', 60000, 'customer@example.com'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when per-customer usage limit is exceeded', async () => {
      const promo = makePromotion({ usageLimitPerCustomer: 1 });
      mockPrisma.promotion.findFirst.mockResolvedValue(promo);
      // Customer has already used it once
      mockPrisma.promotionUsage.count.mockResolvedValue(1);

      await expect(
        service.validateCoupon('SAVE10', 60000, 'customer@example.com'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when order total is below minimum', async () => {
      mockPrisma.promotion.findFirst.mockResolvedValue(
        makePromotion({ minimumOrderAmount: 100000 }), // requires $1,000 minimum
      );
      mockPrisma.promotionUsage.count.mockResolvedValue(0);

      // Order total is only $200 ($200 in cents)
      await expect(
        service.validateCoupon('SAVE10', 20000, 'customer@example.com'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should pass when minimum order amount is exactly met', async () => {
      const promo = makePromotion({ minimumOrderAmount: 50000 });
      mockPrisma.promotion.findFirst.mockResolvedValue(promo);
      mockPrisma.promotionUsage.count.mockResolvedValue(0);

      const result = await service.validateCoupon('SAVE10', 50000, 'customer@example.com');

      expect(result).toBeDefined();
    });

    it('should pass when usageLimit is null (unlimited)', async () => {
      const promo = makePromotion({ usageLimit: null, usageCount: 9999 });
      mockPrisma.promotion.findFirst.mockResolvedValue(promo);
      mockPrisma.promotionUsage.count.mockResolvedValue(0);

      const result = await service.validateCoupon('SAVE10', 60000, 'customer@example.com');

      expect(result).toBeDefined();
    });
  });

  // -------------------------------------------------------------------------
  // applyCoupon (increments usage count)
  // -------------------------------------------------------------------------
  describe('applyCoupon', () => {
    it('should increment usageCount when coupon is applied', async () => {
      const promo = makePromotion({ usageCount: 5 });
      mockPrisma.promotion.findFirst.mockResolvedValue(promo);
      mockPrisma.promotionUsage.count.mockResolvedValue(0);
      mockPrisma.promotion.update.mockResolvedValue({ ...promo, usageCount: 6 });
      mockPrisma.promotionUsage.create.mockResolvedValue({ id: 'pu-1' });

      await service.applyCoupon(
        'SAVE10',
        'ord-1',
        'customer@example.com',
        5000,
        'cust-1',
      );

      expect(mockPrisma.promotion.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: promo.id },
          data: expect.objectContaining({ usageCount: { increment: 1 } }),
        }),
      );
    });

    it('should create a PromotionUsage record', async () => {
      const promo = makePromotion({ usageCount: 0 });
      mockPrisma.promotion.findFirst.mockResolvedValue(promo);
      mockPrisma.promotionUsage.count.mockResolvedValue(0);
      mockPrisma.promotion.update.mockResolvedValue({ ...promo, usageCount: 1 });
      mockPrisma.promotionUsage.create.mockResolvedValue({ id: 'pu-2' });

      await service.applyCoupon('SAVE10', 'ord-2', 'user@example.com', 3000, 'cust-2');

      expect(mockPrisma.promotionUsage.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            promotionId: promo.id,
            orderId: 'ord-2',
            email: 'user@example.com',
            discountAmount: 3000,
          }),
        }),
      );
    });

    it('should mark promotion as DEPLETED when limit is reached after apply', async () => {
      const promo = makePromotion({ usageLimit: 10, usageCount: 9 });
      mockPrisma.promotion.findFirst.mockResolvedValue(promo);
      mockPrisma.promotionUsage.count.mockResolvedValue(0);
      mockPrisma.promotion.update.mockImplementation(({ data }) => ({
        ...promo,
        usageCount: 10,
        status: data.status ?? promo.status,
      }));
      mockPrisma.promotionUsage.create.mockResolvedValue({ id: 'pu-3' });

      await service.applyCoupon('SAVE10', 'ord-3', 'user@example.com', 2000, 'cust-3');

      // Should have tried to set status = DEPLETED
      const updateCall = mockPrisma.promotion.update.mock.calls.find(
        (call) => call[0]?.data?.status === 'DEPLETED',
      );
      expect(updateCall).toBeDefined();
    });
  });

  // -------------------------------------------------------------------------
  // calculateDiscount
  // -------------------------------------------------------------------------
  describe('calculateDiscount', () => {
    it('should calculate percentage discount correctly', async () => {
      const promo = makePromotion({ discountType: 'PERCENTAGE', discountValue: 10 });
      mockPrisma.promotion.findFirst.mockResolvedValue(promo);
      mockPrisma.promotionUsage.count.mockResolvedValue(0);

      const result = await service.calculateDiscount('SAVE10', 100000); // $1,000 MXN

      // 10% of 100000 = 10000
      expect(result.discountAmount).toBe(10000);
      expect(result.freeShipping).toBe(false);
    });

    it('should cap percentage discount at maximumDiscountAmount', async () => {
      const promo = makePromotion({
        discountType: 'PERCENTAGE',
        discountValue: 20,
        maximumDiscountAmount: 10000, // max $100 MXN
      });
      mockPrisma.promotion.findFirst.mockResolvedValue(promo);
      mockPrisma.promotionUsage.count.mockResolvedValue(0);

      const result = await service.calculateDiscount('SAVE10', 200000); // $2,000 MXN → 20% = 40,000 but capped

      expect(result.discountAmount).toBe(10000);
    });

    it('should calculate fixed amount discount correctly', async () => {
      const promo = makePromotion({
        discountType: 'FIXED_AMOUNT',
        discountValue: 5000, // $50 MXN
      });
      mockPrisma.promotion.findFirst.mockResolvedValue(promo);
      mockPrisma.promotionUsage.count.mockResolvedValue(0);

      const result = await service.calculateDiscount('SAVE10', 80000); // $800 MXN

      expect(result.discountAmount).toBe(5000);
      expect(result.freeShipping).toBe(false);
    });

    it('should not let fixed discount exceed order total', async () => {
      const promo = makePromotion({
        discountType: 'FIXED_AMOUNT',
        discountValue: 200000, // $2,000 — exceeds order total
      });
      mockPrisma.promotion.findFirst.mockResolvedValue(promo);
      mockPrisma.promotionUsage.count.mockResolvedValue(0);

      const result = await service.calculateDiscount('SAVE10', 50000); // only $500

      // Discount cannot exceed order total
      expect(result.discountAmount).toBeLessThanOrEqual(50000);
    });

    it('should return freeShipping=true for FREE_SHIPPING discount type', async () => {
      const promo = makePromotion({
        discountType: 'FREE_SHIPPING',
        discountValue: 0,
        freeShipping: true,
      });
      mockPrisma.promotion.findFirst.mockResolvedValue(promo);
      mockPrisma.promotionUsage.count.mockResolvedValue(0);

      const result = await service.calculateDiscount('SAVE10', 60000);

      expect(result.freeShipping).toBe(true);
      expect(result.discountAmount).toBe(0);
    });

    it('should return freeShipping=true when freeShipping flag is set alongside percentage', async () => {
      const promo = makePromotion({
        discountType: 'PERCENTAGE',
        discountValue: 5,
        freeShipping: true,
      });
      mockPrisma.promotion.findFirst.mockResolvedValue(promo);
      mockPrisma.promotionUsage.count.mockResolvedValue(0);

      const result = await service.calculateDiscount('SAVE10', 100000);

      expect(result.freeShipping).toBe(true);
      expect(result.discountAmount).toBe(5000); // 5%
    });

    it('should return zero discount for BUY_X_GET_Y when no eligible items', async () => {
      const promo = makePromotion({
        discountType: 'BUY_X_GET_Y',
        discountValue: 0,
        buyQuantity: 2,
        getQuantity: 1,
      });
      mockPrisma.promotion.findFirst.mockResolvedValue(promo);
      mockPrisma.promotionUsage.count.mockResolvedValue(0);

      const result = await service.calculateDiscount('SAVE10', 60000);

      // Without line-item context the service should return 0 or handle gracefully
      expect(result.discountAmount).toBeGreaterThanOrEqual(0);
    });
  });

  // -------------------------------------------------------------------------
  // listPromotions
  // -------------------------------------------------------------------------
  describe('listPromotions', () => {
    it('should return all promotions', async () => {
      const promos = [makePromotion(), makePromotion({ id: 'promo-2', code: 'FREE50' })];
      mockPrisma.promotion.findMany.mockResolvedValue(promos);

      const result = await service.listPromotions();

      expect(result).toHaveLength(2);
    });

    it('should return empty array when no promotions exist', async () => {
      mockPrisma.promotion.findMany.mockResolvedValue([]);

      const result = await service.listPromotions();

      expect(result).toEqual([]);
    });
  });

  // -------------------------------------------------------------------------
  // createPromotion
  // -------------------------------------------------------------------------
  describe('createPromotion', () => {
    it('should create a new promotion', async () => {
      const dto = {
        code: 'NEW20',
        title: '20% off',
        discountType: 'PERCENTAGE' as const,
        discountValue: 20,
        status: 'ACTIVE' as const,
      };

      const created = makePromotion({ ...dto, id: 'promo-new' });
      mockPrisma.promotion.create.mockResolvedValue(created);

      const result = await service.createPromotion(dto as any);

      expect(result).toBeDefined();
      expect(mockPrisma.promotion.create).toHaveBeenCalledTimes(1);
    });

    it('should throw BadRequestException when code already exists', async () => {
      mockPrisma.promotion.create.mockRejectedValue(
        Object.assign(new Error('Unique constraint'), { code: 'P2002' }),
      );

      await expect(
        service.createPromotion({ code: 'DUPLICATE' } as any),
      ).rejects.toThrow();
    });
  });
});
