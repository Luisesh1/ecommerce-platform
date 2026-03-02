import { OrderStatus, PaymentStatus, PaymentMethod, PaymentGateway } from '../enums';
import { Address } from './user.types';

export interface OrderItem {
  id: string;
  orderId: string;
  productId: string;
  variantId: string;
  sku: string;
  title: string;
  variantTitle: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  discountAmount: number;
  taxAmount: number;
  imageUrl?: string;
  requiresShipping: boolean;
  fulfillmentStatus?: string;
  returnedQuantity: number;
  refundedAmount: number;
}

export interface OrderTimeline {
  id: string;
  orderId: string;
  status: OrderStatus;
  message: string;
  metadata?: Record<string, unknown>;
  createdBy?: string;
  createdAt: Date;
}

export interface Refund {
  id: string;
  orderId: string;
  paymentId: string;
  amount: number;
  reason: string;
  note?: string;
  lineItems: RefundLineItem[];
  status: PaymentStatus;
  gatewayRefundId?: string;
  createdAt: Date;
}

export interface RefundLineItem {
  orderItemId: string;
  quantity: number;
  amount: number;
}

export interface Order {
  id: string;
  orderNumber: string;
  customerId?: string;
  email: string;
  phone?: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  lineItems: OrderItem[];
  subtotal: number;
  discountAmount: number;
  shippingAmount: number;
  taxAmount: number;
  totalAmount: number;
  currency: string;
  shippingAddress: Address;
  billingAddress?: Address;
  shippingMethodId?: string;
  shippingMethodName?: string;
  trackingNumber?: string;
  trackingUrl?: string;
  notes?: string;
  couponCode?: string;
  promotionId?: string;
  timeline: OrderTimeline[];
  refunds: Refund[];
  paymentMethod?: PaymentMethod;
  gateway?: PaymentGateway;
  gatewayOrderId?: string;
  ipAddress?: string;
  userAgent?: string;
  fraudScore?: number;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
  fulfilledAt?: Date;
  cancelledAt?: Date;
}

export interface Cart {
  id: string;
  sessionId?: string;
  customerId?: string;
  items: CartItem[];
  subtotal: number;
  discountAmount: number;
  shippingAmount?: number;
  taxAmount?: number;
  totalAmount: number;
  couponCode?: string;
  promotionId?: string;
  currency: string;
  expiresAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface CartItem {
  id: string;
  cartId: string;
  productId: string;
  variantId: string;
  sku: string;
  title: string;
  variantTitle: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  imageUrl?: string;
  requiresShipping: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CheckoutSession {
  orderId?: string;
  cartId: string;
  step: number;
  email?: string;
  phone?: string;
  shippingAddress?: Partial<Address>;
  billingAddress?: Partial<Address>;
  shippingMethodId?: string;
  paymentMethod?: PaymentMethod;
  couponCode?: string;
  notes?: string;
  agreeToTerms: boolean;
  marketingConsent: boolean;
}

export interface ShippingRate {
  id: string;
  name: string;
  description?: string;
  price: number;
  currency: string;
  minDeliveryDays?: number;
  maxDeliveryDays?: number;
  carrier?: string;
}

export interface OrderPDF {
  id: string;
  orderId: string;
  type: 'PACKING_SLIP' | 'SHIPPING_LABEL' | 'INVOICE';
  url: string;
  generatedAt: Date;
}
