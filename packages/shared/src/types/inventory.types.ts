import { InventoryMovementType } from '../enums';

export interface InventoryLevel {
  id: string;
  variantId: string;
  quantity: number;
  reservedQuantity: number;
  availableQuantity: number;
  lowStockThreshold?: number;
  isLowStock: boolean;
  updatedAt: Date;
}

export interface InventoryMovement {
  id: string;
  variantId: string;
  type: InventoryMovementType;
  quantity: number;
  previousQuantity: number;
  newQuantity: number;
  reason?: string;
  referenceId?: string;
  referenceType?: string;
  createdBy?: string;
  createdAt: Date;
}

export interface InventoryReservation {
  id: string;
  variantId: string;
  cartId?: string;
  orderId?: string;
  quantity: number;
  expiresAt: Date;
  confirmedAt?: Date;
  releasedAt?: Date;
  jobId?: string;
  createdAt: Date;
}

export interface StockAlert {
  variantId: string;
  sku: string;
  productTitle: string;
  variantTitle: string;
  currentQuantity: number;
  threshold: number;
  type: 'LOW_STOCK' | 'OUT_OF_STOCK';
}

export interface BulkInventoryUpdate {
  variantId: string;
  sku: string;
  quantity: number;
  reason?: string;
}
