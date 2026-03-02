import { ChatStatus, TicketPriority, FraudRiskLevel, BackupStatus, ImportJobStatus, ExportJobStatus, ImportEntityType } from '../enums';

export interface ChatConversation {
  id: string;
  customerId?: string;
  sessionId?: string;
  email?: string;
  status: ChatStatus;
  subject?: string;
  assignedTo?: string;
  messages: ChatMessage[];
  createdAt: Date;
  updatedAt: Date;
  resolvedAt?: Date;
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  senderId?: string;
  senderType: 'CUSTOMER' | 'AGENT' | 'BOT';
  content: string;
  attachments?: string[];
  readAt?: Date;
  createdAt: Date;
}

export interface SupportTicket {
  id: string;
  conversationId?: string;
  customerId?: string;
  orderId?: string;
  email: string;
  subject: string;
  priority: TicketPriority;
  status: ChatStatus;
  assignedTo?: string;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface FeatureFlag {
  id: string;
  key: string;
  name: string;
  description?: string;
  isEnabled: boolean;
  conditions?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface AuditLog {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  userId?: string;
  userEmail?: string;
  ipAddress?: string;
  userAgent?: string;
  beforeData?: Record<string, unknown>;
  afterData?: Record<string, unknown>;
  diffData?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

export interface BackupRun {
  id: string;
  filename: string;
  size?: number;
  status: BackupStatus;
  location?: string;
  checksum?: string;
  error?: string;
  startedAt: Date;
  completedAt?: Date;
  expiresAt?: Date;
}

export interface ImportJob {
  id: string;
  entityType: ImportEntityType;
  filename: string;
  totalRows: number;
  processedRows: number;
  successRows: number;
  errorRows: number;
  status: ImportJobStatus;
  errors?: ImportError[];
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
}

export interface ImportError {
  row: number;
  field: string;
  message: string;
  value?: unknown;
}

export interface ExportJob {
  id: string;
  entityType: ImportEntityType;
  filename: string;
  totalRows?: number;
  status: ExportJobStatus;
  downloadUrl?: string;
  createdBy: string;
  createdAt: Date;
  completedAt?: Date;
  expiresAt?: Date;
}

export interface FraudEvent {
  id: string;
  orderId?: string;
  customerId?: string;
  email?: string;
  ipAddress?: string;
  riskLevel: FraudRiskLevel;
  riskScore: number;
  triggers: string[];
  action: 'ALLOW' | 'REVIEW' | 'BLOCK';
  createdAt: Date;
}

export interface PushSubscription {
  id: string;
  customerId?: string;
  sessionId?: string;
  endpoint: string;
  p256dhKey: string;
  authKey: string;
  userAgent?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Setting {
  key: string;
  value: string;
  isEncrypted: boolean;
  description?: string;
  group: string;
  updatedAt: Date;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export interface ApiError {
  statusCode: number;
  message: string;
  error?: string;
  details?: Record<string, string[]>;
  requestId?: string;
  timestamp: string;
}

export interface HealthStatus {
  status: 'ok' | 'degraded' | 'down';
  timestamp: string;
  uptime: number;
  version: string;
  services: Record<string, ServiceHealth>;
}

export interface ServiceHealth {
  status: 'ok' | 'degraded' | 'down';
  responseTime?: number;
  message?: string;
  details?: Record<string, unknown>;
}
