import {
  Controller,
  Get,
  Patch,
  Param,
  Body,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { FeaturesService } from './features.service';
import { UpdateFeatureFlagDto } from './dto/feature.dto';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@ApiTags('Features')
@Controller()
export class FeaturesController {
  constructor(private readonly featuresService: FeaturesService) {}

  /**
   * Public endpoint - returns { features: { [key]: boolean } }
   * Used by the storefront to enable/disable UI features.
   */
  @Public()
  @Get('public/config')
  @ApiOperation({ summary: 'Get public feature flag config' })
  async getPublicConfig() {
    const features = await this.featuresService.getPublicConfig();
    return { features };
  }

  /**
   * Admin: list all feature flags with full detail.
   */
  @ApiBearerAuth('access-token')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @Get('admin/features')
  @ApiOperation({ summary: 'List all feature flags (admin)' })
  async findAll() {
    return this.featuresService.findAll();
  }

  /**
   * Admin: enable or disable a flag by its key.
   */
  @ApiBearerAuth('access-token')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @Patch('admin/features/:key')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update feature flag enabled state (admin)' })
  async update(
    @Param('key') key: string,
    @Body() dto: UpdateFeatureFlagDto,
  ) {
    return this.featuresService.update(key, dto.enabled);
  }
}
