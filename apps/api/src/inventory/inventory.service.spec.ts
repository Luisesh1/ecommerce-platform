import { Test, TestingModule } from '@nestjs/testing';
import { InventoryService } from './inventory.service';
import { PrismaService } from '../prisma/prisma.service';
import { getQueueToken } from '@nestjs/bull';
import { NotFoundException, BadRequestException } from '@nestjs/common';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockPrisma = {
  inventoryLevel: {
    findUnique: jest.fn(),
    upsert: jest.fn(),
    update: jest.fn(),
    findMany: jest.fn(),
  },
  inventoryMovement: {
    create: jest.fn(),
    findMany: jest.fn(),
  },
  inventoryReservation: {
    create: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    findMany: jest.fn(),
    deleteMany: jest.fn(),
  },
  $transaction: jest.fn((cb: (prisma: any) => unknown) => cb(mockPrisma)),
};

const mockQueue = {
  add: jest.fn(),
  getJob: jest.fn(),
  removeJobs: jest.fn(),
};

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('InventoryService', () => {
  let service: InventoryService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InventoryService,
        { provide: PrismaService,                    useValue: mockPrisma },
        { provide: getQueueToken('inventory-expiry'), useValue: mockQueue  },
      ],
    }).compile();

    service = module.get<InventoryService>(InventoryService);
    jest.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // getInventoryLevel
  // -------------------------------------------------------------------------
  describe('getInventoryLevel', () => {
    it('should return inventory level for a variant', async () => {
      const mockLevel = {
        id: 'il-1',
        variantId: 'v1',
        quantity: 10,
        reservedQuantity: 2,
        lowStockThreshold: 5,
        updatedAt: new Date(),
      };
      mockPrisma.inventoryLevel.findUnique.mockResolvedValue(mockLevel);

      const result = await service.getInventoryLevel('v1');

      expect(result).toEqual(mockLevel);
      expect(mockPrisma.inventoryLevel.findUnique).toHaveBeenCalledWith({
        where: { variantId: 'v1' },
        include: expect.any(Object),
      });
    });

    it('should throw NotFoundException when variant not found', async () => {
      mockPrisma.inventoryLevel.findUnique.mockResolvedValue(null);

      await expect(service.getInventoryLevel('nonexistent')).rejects.toThrow(NotFoundException);
      expect(mockPrisma.inventoryLevel.findUnique).toHaveBeenCalledTimes(1);
    });

    it('should call findUnique with correct variantId', async () => {
      const variantId = 'variant-xyz';
      mockPrisma.inventoryLevel.findUnique.mockResolvedValue({
        id: 'il-2', variantId, quantity: 5, reservedQuantity: 0,
      });

      await service.getInventoryLevel(variantId);

      expect(mockPrisma.inventoryLevel.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { variantId } }),
      );
    });
  });

  // -------------------------------------------------------------------------
  // adjustStock
  // -------------------------------------------------------------------------
  describe('adjustStock', () => {
    it('should adjust stock upward and create movement record', async () => {
      mockPrisma.inventoryLevel.findUnique.mockResolvedValue({
        id: 'il-1', variantId: 'v1', quantity: 10, reservedQuantity: 0,
      });
      mockPrisma.inventoryLevel.update.mockResolvedValue({
        id: 'il-1', variantId: 'v1', quantity: 15, reservedQuantity: 0,
      });
      mockPrisma.inventoryMovement.create.mockResolvedValue({ id: 'm1' });

      const result = await service.adjustStock('v1', 5, 'Manual adjustment', 'user1');

      expect(result.quantity).toBe(15);
      expect(mockPrisma.inventoryMovement.create).toHaveBeenCalledTimes(1);
      expect(mockPrisma.inventoryMovement.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            variantId: 'v1',
            quantity: 5,
            previousQuantity: 10,
            newQuantity: 15,
          }),
        }),
      );
    });

    it('should adjust stock downward successfully', async () => {
      mockPrisma.inventoryLevel.findUnique.mockResolvedValue({
        id: 'il-1', variantId: 'v1', quantity: 20, reservedQuantity: 0,
      });
      mockPrisma.inventoryLevel.update.mockResolvedValue({
        id: 'il-1', variantId: 'v1', quantity: 15, reservedQuantity: 0,
      });
      mockPrisma.inventoryMovement.create.mockResolvedValue({ id: 'm2' });

      const result = await service.adjustStock('v1', -5, 'Stock correction', 'user1');

      expect(result.quantity).toBe(15);
      expect(mockPrisma.inventoryMovement.create).toHaveBeenCalled();
    });

    it('should throw BadRequestException when stock goes negative', async () => {
      mockPrisma.inventoryLevel.findUnique.mockResolvedValue({
        id: 'il-1', variantId: 'v1', quantity: 5, reservedQuantity: 0,
      });

      await expect(
        service.adjustStock('v1', -10, 'Test', 'user1'),
      ).rejects.toThrow(BadRequestException);

      expect(mockPrisma.inventoryLevel.update).not.toHaveBeenCalled();
      expect(mockPrisma.inventoryMovement.create).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when inventory level does not exist', async () => {
      mockPrisma.inventoryLevel.findUnique.mockResolvedValue(null);

      await expect(
        service.adjustStock('ghost-variant', 5, 'Test', 'user1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should include reason and createdBy in movement record', async () => {
      mockPrisma.inventoryLevel.findUnique.mockResolvedValue({
        id: 'il-1', variantId: 'v1', quantity: 10, reservedQuantity: 0,
      });
      mockPrisma.inventoryLevel.update.mockResolvedValue({
        id: 'il-1', variantId: 'v1', quantity: 11, reservedQuantity: 0,
      });
      mockPrisma.inventoryMovement.create.mockResolvedValue({ id: 'm3' });

      await service.adjustStock('v1', 1, 'Recount after audit', 'admin-user');

      expect(mockPrisma.inventoryMovement.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            reason: 'Recount after audit',
            createdBy: 'admin-user',
          }),
        }),
      );
    });
  });

  // -------------------------------------------------------------------------
  // reserveStock
  // -------------------------------------------------------------------------
  describe('reserveStock', () => {
    it('should create reservation and queue expiry job', async () => {
      mockPrisma.inventoryLevel.findUnique.mockResolvedValue({
        id: 'il-1', variantId: 'v1', quantity: 10, reservedQuantity: 2,
      });
      mockPrisma.inventoryLevel.update.mockResolvedValue({
        id: 'il-1', quantity: 10, reservedQuantity: 5,
      });
      mockPrisma.inventoryReservation.create.mockResolvedValue({
        id: 'r1', variantId: 'v1', quantity: 3, cartId: 'cart1',
      });
      mockQueue.add.mockResolvedValue({ id: 'job-1' });

      const result = await service.reserveStock('v1', 3, 'cart1');

      expect(result.id).toBe('r1');
      expect(mockQueue.add).toHaveBeenCalledWith(
        'expire-reservation',
        expect.any(Object),
        expect.any(Object),
      );
    });

    it('should throw BadRequestException when insufficient available stock', async () => {
      // quantity=5, reservedQuantity=4 → available=1, requesting 3
      mockPrisma.inventoryLevel.findUnique.mockResolvedValue({
        id: 'il-1', variantId: 'v1', quantity: 5, reservedQuantity: 4,
      });

      await expect(service.reserveStock('v1', 3, 'cart1')).rejects.toThrow(BadRequestException);

      expect(mockPrisma.inventoryReservation.create).not.toHaveBeenCalled();
      expect(mockPrisma.inventoryLevel.update).not.toHaveBeenCalled();
      expect(mockQueue.add).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when inventory level not found', async () => {
      mockPrisma.inventoryLevel.findUnique.mockResolvedValue(null);

      await expect(service.reserveStock('ghost', 1, 'cart2')).rejects.toThrow(NotFoundException);
    });

    it('should update reservedQuantity on the inventory level', async () => {
      mockPrisma.inventoryLevel.findUnique.mockResolvedValue({
        id: 'il-1', variantId: 'v1', quantity: 10, reservedQuantity: 0,
      });
      mockPrisma.inventoryLevel.update.mockResolvedValue({
        id: 'il-1', quantity: 10, reservedQuantity: 3,
      });
      mockPrisma.inventoryReservation.create.mockResolvedValue({
        id: 'r2', variantId: 'v1', quantity: 3, cartId: 'cart3',
      });
      mockQueue.add.mockResolvedValue({ id: 'job-2' });

      await service.reserveStock('v1', 3, 'cart3');

      expect(mockPrisma.inventoryLevel.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ variantId: 'v1' }),
          data: expect.objectContaining({ reservedQuantity: expect.any(Number) }),
        }),
      );
    });

    it('should set expiry job with delay option', async () => {
      mockPrisma.inventoryLevel.findUnique.mockResolvedValue({
        id: 'il-1', variantId: 'v1', quantity: 20, reservedQuantity: 0,
      });
      mockPrisma.inventoryLevel.update.mockResolvedValue({
        id: 'il-1', quantity: 20, reservedQuantity: 2,
      });
      mockPrisma.inventoryReservation.create.mockResolvedValue({
        id: 'r3', variantId: 'v1', quantity: 2, cartId: 'cart4',
      });
      mockQueue.add.mockResolvedValue({ id: 'job-3' });

      await service.reserveStock('v1', 2, 'cart4');

      expect(mockQueue.add).toHaveBeenCalledWith(
        'expire-reservation',
        expect.any(Object),
        expect.objectContaining({ delay: expect.any(Number) }),
      );
    });
  });

  // -------------------------------------------------------------------------
  // releaseReservation
  // -------------------------------------------------------------------------
  describe('releaseReservation', () => {
    it('should release a reservation and decrement reservedQuantity', async () => {
      const reservation = {
        id: 'r1', variantId: 'v1', quantity: 3, cartId: 'cart1',
        expiresAt: new Date(), confirmedAt: null, releasedAt: null, jobId: 'job-1',
      };
      mockPrisma.inventoryReservation.findUnique.mockResolvedValue(reservation);
      mockPrisma.inventoryLevel.findUnique.mockResolvedValue({
        id: 'il-1', variantId: 'v1', quantity: 10, reservedQuantity: 3,
      });
      mockPrisma.inventoryLevel.update.mockResolvedValue({
        id: 'il-1', quantity: 10, reservedQuantity: 0,
      });
      mockPrisma.inventoryReservation.update.mockResolvedValue({
        ...reservation, releasedAt: new Date(),
      });
      mockQueue.getJob.mockResolvedValue({ remove: jest.fn() });

      await service.releaseReservation('r1');

      expect(mockPrisma.inventoryReservation.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'r1' },
          data: expect.objectContaining({ releasedAt: expect.any(Date) }),
        }),
      );
    });

    it('should throw NotFoundException when reservation does not exist', async () => {
      mockPrisma.inventoryReservation.findUnique.mockResolvedValue(null);

      await expect(service.releaseReservation('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  // -------------------------------------------------------------------------
  // getLowStockItems
  // -------------------------------------------------------------------------
  describe('getLowStockItems', () => {
    it('should return items where available quantity is below threshold', async () => {
      const mockItems = [
        { id: 'il-1', variantId: 'v1', quantity: 3, reservedQuantity: 0, lowStockThreshold: 5 },
        { id: 'il-2', variantId: 'v2', quantity: 1, reservedQuantity: 0, lowStockThreshold: 5 },
      ];
      mockPrisma.inventoryLevel.findMany.mockResolvedValue(mockItems);

      const result = await service.getLowStockItems(5);

      expect(result).toHaveLength(2);
      expect(mockPrisma.inventoryLevel.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.any(Object),
        }),
      );
    });

    it('should use default threshold when none provided', async () => {
      mockPrisma.inventoryLevel.findMany.mockResolvedValue([]);

      await service.getLowStockItems();

      expect(mockPrisma.inventoryLevel.findMany).toHaveBeenCalled();
    });

    it('should return empty array when all items are above threshold', async () => {
      mockPrisma.inventoryLevel.findMany.mockResolvedValue([]);

      const result = await service.getLowStockItems(5);

      expect(result).toHaveLength(0);
      expect(Array.isArray(result)).toBe(true);
    });

    it('should include variant data in results', async () => {
      const mockItems = [
        {
          id: 'il-1',
          variantId: 'v1',
          quantity: 2,
          reservedQuantity: 0,
          variant: { id: 'v1', sku: 'SKU-001', title: 'Red / S' },
        },
      ];
      mockPrisma.inventoryLevel.findMany.mockResolvedValue(mockItems);

      const result = await service.getLowStockItems(5);

      expect(result[0]).toHaveProperty('variant');
    });
  });

  // -------------------------------------------------------------------------
  // getMovementHistory
  // -------------------------------------------------------------------------
  describe('getMovementHistory', () => {
    it('should return movement history for a variant', async () => {
      const movements = [
        {
          id: 'm1', variantId: 'v1', type: 'ADJUSTMENT',
          quantity: 5, previousQuantity: 10, newQuantity: 15,
          reason: 'Manual', createdAt: new Date(),
        },
      ];
      mockPrisma.inventoryMovement.findMany.mockResolvedValue(movements);

      const result = await service.getMovementHistory('v1');

      expect(result).toHaveLength(1);
      expect(result[0].variantId).toBe('v1');
    });

    it('should return empty array when no movements exist', async () => {
      mockPrisma.inventoryMovement.findMany.mockResolvedValue([]);

      const result = await service.getMovementHistory('v1');

      expect(result).toEqual([]);
    });
  });
});
