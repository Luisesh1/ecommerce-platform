import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  HttpCode,
  HttpStatus,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Request } from 'express';
import { NotificationsService, PushSubscriptionDto } from './notifications.service';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import {
  IsString,
  IsObject,
  ValidateNested,
  IsOptional,
  IsUrl,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

class PushKeysDto {
  @ApiProperty()
  @IsString()
  p256dh: string;

  @ApiProperty()
  @IsString()
  auth: string;
}

class SubscribeDto implements PushSubscriptionDto {
  @ApiProperty({ description: 'Push subscription endpoint URL' })
  @IsUrl({ require_tld: false })
  endpoint: string;

  @ApiProperty({ type: PushKeysDto })
  @IsObject()
  @ValidateNested()
  @Type(() => PushKeysDto)
  keys: PushKeysDto;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  userAgent?: string;
}

class UnsubscribeDto {
  @ApiProperty({ description: 'Push subscription endpoint URL to remove' })
  @IsString()
  endpoint: string;
}

interface AuthUser {
  id: string;
  email: string;
}

@ApiTags('Notifications')
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  /**
   * Returns the VAPID public key - required by the client to create a push subscription.
   * This endpoint is public so the frontend can access it without auth.
   */
  @Public()
  @Get('vapid-public-key')
  @ApiOperation({ summary: 'Get VAPID public key for web push (public)' })
  getVapidPublicKey() {
    return { vapidPublicKey: this.notificationsService.getVapidPublicKey() };
  }

  /**
   * Save a push subscription for the current user.
   */
  @ApiBearerAuth('access-token')
  @Post('subscribe')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Register a push subscription for the current user' })
  async subscribe(
    @CurrentUser() user: AuthUser,
    @Body() dto: SubscribeDto,
    @Req() req: Request,
  ) {
    const userAgent = req.headers['user-agent'] ?? dto.userAgent;
    return this.notificationsService.subscribe(user.id, undefined, {
      ...dto,
      userAgent: userAgent as string | undefined,
    });
  }

  /**
   * Remove a push subscription.
   */
  @ApiBearerAuth('access-token')
  @Delete('subscribe')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove a push subscription' })
  async unsubscribe(@Body() dto: UnsubscribeDto) {
    await this.notificationsService.unsubscribe(dto.endpoint);
  }
}
