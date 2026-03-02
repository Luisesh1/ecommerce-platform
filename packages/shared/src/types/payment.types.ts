import { PaymentGateway, PaymentMethod, PaymentStatus } from '../enums';

export interface Payment {
  id: string;
  orderId: string;
  gateway: PaymentGateway;
  method: PaymentMethod;
  status: PaymentStatus;
  amount: number;
  currency: string;
  gatewayPaymentId?: string;
  gatewayOrderId?: string;
  gatewayCustomerId?: string;
  clientSecret?: string;
  metadata?: Record<string, unknown>;
  failureCode?: string;
  failureMessage?: string;
  refundedAmount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface PaymentIntent {
  id: string;
  clientSecret?: string;
  amount: number;
  currency: string;
  status: string;
  gatewayPaymentId: string;
  metadata?: Record<string, unknown>;
}

export interface PaymentGatewayConfig {
  id: string;
  gateway: PaymentGateway;
  isEnabled: boolean;
  isSandbox: boolean;
  displayName: string;
  iconUrl?: string;
  supportedMethods: PaymentMethod[];
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface PublicGatewayConfig {
  gateway: PaymentGateway;
  displayName: string;
  iconUrl?: string;
  supportedMethods: PaymentMethod[];
  publicKey?: string;
  isSandbox: boolean;
}

export interface WebhookEvent {
  id: string;
  gateway: PaymentGateway;
  eventId: string;
  eventType: string;
  payload: Record<string, unknown>;
  status: string;
  processingAttempts: number;
  lastError?: string;
  processedAt?: Date;
  createdAt: Date;
}

export interface GatewayCredentials {
  publicKey?: string;
  secretKey?: string;
  webhookSecret?: string;
  merchantId?: string;
  clientId?: string;
  clientSecret?: string;
  accessToken?: string;
  webhookId?: string;
}
