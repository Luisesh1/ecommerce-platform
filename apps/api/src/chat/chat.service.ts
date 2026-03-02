import {
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { buildPaginatedResponse, PaginatedResponse } from '../common/dto/pagination.dto';

export interface ChatMessage {
  id: string;
  conversationId: string;
  content: string;
  senderId: string | null;
  senderType: string;
  isRead: boolean;
  createdAt: Date;
}

export interface ChatConversation {
  id: string;
  userId: string | null;
  status: string;
  assignedTo: string | null;
  subject: string | null;
  createdAt: Date;
  updatedAt: Date;
  messages?: ChatMessage[];
}

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getConversations(
    status?: string,
    page = 1,
    limit = 20,
  ): Promise<PaginatedResponse<ChatConversation>> {
    const where = status ? { status } : {};
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      (this.prisma as any).chatConversation.findMany({
        where,
        skip,
        take: limit,
        orderBy: { updatedAt: 'desc' },
        include: {
          messages: {
            take: 1,
            orderBy: { createdAt: 'desc' },
          },
        },
      }),
      (this.prisma as any).chatConversation.count({ where }),
    ]);

    return buildPaginatedResponse<ChatConversation>(data, total, page, limit);
  }

  async getMessages(
    conversationId: string,
    page = 1,
    limit = 50,
  ): Promise<PaginatedResponse<ChatMessage>> {
    const conversation = await (this.prisma as any).chatConversation.findUnique({
      where: { id: conversationId },
    });
    if (!conversation) throw new NotFoundException('Conversation not found');

    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      (this.prisma as any).chatMessage.findMany({
        where: { conversationId },
        skip,
        take: limit,
        orderBy: { createdAt: 'asc' },
      }),
      (this.prisma as any).chatMessage.count({ where: { conversationId } }),
    ]);

    return buildPaginatedResponse<ChatMessage>(data, total, page, limit);
  }

  async saveMessage(
    conversationId: string,
    content: string,
    senderId: string | null,
    senderType: 'USER' | 'AGENT' | 'SYSTEM' = 'USER',
  ): Promise<ChatMessage> {
    let conversation = await (this.prisma as any).chatConversation.findUnique({
      where: { id: conversationId },
    });

    if (!conversation) {
      conversation = await (this.prisma as any).chatConversation.create({
        data: {
          id: conversationId,
          status: 'OPEN',
          userId: senderId,
        },
      });
    }

    const message = await (this.prisma as any).chatMessage.create({
      data: {
        conversationId,
        content,
        senderId,
        senderType,
        isRead: false,
      },
    });

    await (this.prisma as any).chatConversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    });

    return message as ChatMessage;
  }

  async sendAgentMessage(
    conversationId: string,
    content: string,
    agentId: string,
  ): Promise<ChatMessage> {
    const conversation = await (this.prisma as any).chatConversation.findUnique({
      where: { id: conversationId },
    });
    if (!conversation) throw new NotFoundException('Conversation not found');

    return this.saveMessage(conversationId, content, agentId, 'AGENT');
  }

  async markMessagesAsRead(conversationId: string, userId: string): Promise<void> {
    await (this.prisma as any).chatMessage.updateMany({
      where: {
        conversationId,
        senderId: { not: userId },
        isRead: false,
      },
      data: { isRead: true },
    });
  }

  async updateConversation(
    conversationId: string,
    data: { status?: string; assignedTo?: string },
  ): Promise<ChatConversation> {
    const conversation = await (this.prisma as any).chatConversation.findUnique({
      where: { id: conversationId },
    });
    if (!conversation) throw new NotFoundException('Conversation not found');

    return (this.prisma as any).chatConversation.update({
      where: { id: conversationId },
      data,
    }) as Promise<ChatConversation>;
  }

  async getOrCreateConversation(conversationId: string, userId?: string): Promise<ChatConversation> {
    const existing = await (this.prisma as any).chatConversation.findUnique({
      where: { id: conversationId },
    });
    if (existing) return existing as ChatConversation;

    return (this.prisma as any).chatConversation.create({
      data: {
        id: conversationId,
        status: 'OPEN',
        userId: userId ?? null,
      },
    }) as Promise<ChatConversation>;
  }
}
