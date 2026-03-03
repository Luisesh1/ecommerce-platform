import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { ChatService } from './chat.service';
import { ChatGateway } from './chat.gateway';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

class SendAgentMessageDto {
  content!: string;
  agentId!: string;
}

class UpdateConversationDto {
  status?: string;
  assignedTo?: string;
}

@ApiTags('Admin - Chat')
@ApiBearerAuth()
@Roles(UserRole.ADMIN, UserRole.SUPPORT)
@Controller('admin/chat')
export class ChatController {
  constructor(
    private readonly chatService: ChatService,
    private readonly chatGateway: ChatGateway,
  ) {}

  @ApiOperation({ summary: 'List conversations with optional status filter' })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @Get('conversations')
  async getConversations(
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.chatService.getConversations(
      status,
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20,
    );
  }

  @ApiOperation({ summary: 'Get paginated messages for a conversation' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @Get(':id/messages')
  async getMessages(
    @Param('id') id: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.chatService.getMessages(
      id,
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 50,
    );
  }

  @ApiOperation({ summary: 'Send message as agent' })
  @HttpCode(HttpStatus.CREATED)
  @Post(':id/messages')
  async sendAgentMessage(
    @Param('id') id: string,
    @Body() dto: SendAgentMessageDto,
  ) {
    const message = await this.chatService.sendAgentMessage(id, dto.content, dto.agentId);
    // Push message to WebSocket room
    this.chatGateway.broadcastAgentMessage(id, message);
    return message;
  }

  @ApiOperation({ summary: 'Update conversation status or assignedTo' })
  @Patch(':id')
  async updateConversation(
    @Param('id') id: string,
    @Body() dto: UpdateConversationDto,
  ) {
    return this.chatService.updateConversation(id, dto);
  }
}
