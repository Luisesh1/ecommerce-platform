import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { TrackingService } from './tracking.service';
import { TrackEventDto, UpdateTrackingConfigDto } from './dto/tracking.dto';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@ApiTags('Tracking')
@Controller()
export class TrackingController {
  constructor(private readonly trackingService: TrackingService) {}

  @ApiOperation({ summary: 'Ingest a tracking event (public, deduplicated)' })
  @Public()
  @HttpCode(HttpStatus.ACCEPTED)
  @Post('api/tracking/event')
  async trackEvent(@Body() dto: TrackEventDto) {
    return this.trackingService.ingestEvent(dto);
  }

  @ApiOperation({ summary: 'Get tracking configuration (GA4, Meta)' })
  @ApiBearerAuth()
  @Roles(UserRole.ADMIN)
  @Get('api/admin/settings/tracking')
  async getConfig() {
    return this.trackingService.getConfig();
  }

  @ApiOperation({ summary: 'Update tracking configuration' })
  @ApiBearerAuth()
  @Roles(UserRole.ADMIN)
  @Patch('api/admin/settings/tracking')
  async updateConfig(@Body() dto: UpdateTrackingConfigDto) {
    return this.trackingService.updateConfig(dto);
  }
}
