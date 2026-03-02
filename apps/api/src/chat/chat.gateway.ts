import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { ChatService } from './chat.service';

interface RateLimitEntry {
  timestamps: number[];
}

const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute
const RATE_LIMIT_MAX_MESSAGES = 20;

@WebSocketGateway({
  cors: { origin: '*' },
  namespace: '/chat',
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(ChatGateway.name);

  // Map of socketId -> RateLimitEntry
  private readonly rateLimitMap = new Map<string, RateLimitEntry>();

  constructor(private readonly chatService: ChatService) {}

  handleConnection(client: Socket): void {
    this.logger.log(`Client connected: ${client.id}`);
    this.rateLimitMap.set(client.id, { timestamps: [] });
  }

  handleDisconnect(client: Socket): void {
    this.logger.log(`Client disconnected: ${client.id}`);
    this.rateLimitMap.delete(client.id);
  }

  /**
   * Checks whether the socket has exceeded 20 messages/minute.
   * Returns true if rate limit is exceeded.
   */
  private isRateLimited(socketId: string): boolean {
    const entry = this.rateLimitMap.get(socketId);
    if (!entry) return false;

    const now = Date.now();
    // Remove timestamps older than the window
    entry.timestamps = entry.timestamps.filter(
      (ts) => now - ts < RATE_LIMIT_WINDOW_MS,
    );

    if (entry.timestamps.length >= RATE_LIMIT_MAX_MESSAGES) {
      return true;
    }

    entry.timestamps.push(now);
    return false;
  }

  @SubscribeMessage('join')
  async handleJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { conversationId: string; userId?: string },
  ): Promise<void> {
    const { conversationId, userId } = data;
    await client.join(conversationId);
    await this.chatService.getOrCreateConversation(conversationId, userId);
    this.logger.log(`Socket ${client.id} joined room ${conversationId}`);
    client.emit('joined', { conversationId });
  }

  @SubscribeMessage('message')
  async handleMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: {
      conversationId: string;
      content: string;
      senderId?: string;
    },
  ): Promise<void> {
    if (this.isRateLimited(client.id)) {
      client.emit('error', {
        event: 'message',
        reason: 'Rate limit exceeded: max 20 messages per minute',
      });
      return;
    }

    const { conversationId, content, senderId } = data;

    try {
      const message = await this.chatService.saveMessage(
        conversationId,
        content,
        senderId ?? null,
        'USER',
      );

      // Broadcast to all clients in the room
      this.server.to(conversationId).emit('message', message);
    } catch (err) {
      this.logger.error(`Failed to save message: ${(err as Error).message}`);
      client.emit('error', {
        event: 'message',
        reason: 'Failed to save message',
      });
    }
  }

  @SubscribeMessage('typing')
  handleTyping(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { conversationId: string; userId?: string; isTyping: boolean },
  ): void {
    const { conversationId, userId, isTyping } = data;
    // Broadcast to everyone else in the room
    client.to(conversationId).emit('typing', { userId, isTyping });
  }

  @SubscribeMessage('read')
  async handleRead(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { conversationId: string; userId: string },
  ): Promise<void> {
    const { conversationId, userId } = data;

    try {
      await this.chatService.markMessagesAsRead(conversationId, userId);
      // Notify room that messages were read
      this.server.to(conversationId).emit('read', { conversationId, userId });
    } catch (err) {
      this.logger.error(`Failed to mark as read: ${(err as Error).message}`);
      client.emit('error', {
        event: 'read',
        reason: 'Failed to mark messages as read',
      });
    }
  }

  /**
   * Allows the REST controller to push agent messages to the room.
   */
  broadcastAgentMessage(conversationId: string, message: unknown): void {
    this.server.to(conversationId).emit('message', message);
  }
}
