import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsObject,
  IsNotEmpty,
} from 'class-validator';

export class TrackEventDto {
  @ApiProperty({ description: 'Name of the event, e.g. page_view, add_to_cart' })
  @IsString()
  @IsNotEmpty()
  event_name!: string;

  @ApiProperty({ description: 'Unique event ID used for deduplication (24h TTL in Redis)' })
  @IsString()
  @IsNotEmpty()
  event_id!: string;

  @ApiPropertyOptional({ description: 'Authenticated user ID if available' })
  @IsOptional()
  @IsString()
  user_id?: string;

  @ApiProperty({ description: 'Anonymous session ID' })
  @IsString()
  @IsNotEmpty()
  session_id!: string;

  @ApiPropertyOptional({ description: 'Additional event parameters' })
  @IsOptional()
  @IsObject()
  params?: Record<string, unknown>;
}

export class UpdateTrackingConfigDto {
  @ApiPropertyOptional({ description: 'Google Analytics 4 Measurement ID' })
  @IsOptional()
  @IsString()
  ga4_measurement_id?: string;

  @ApiPropertyOptional({ description: 'Google Analytics 4 API secret' })
  @IsOptional()
  @IsString()
  ga4_api_secret?: string;

  @ApiPropertyOptional({ description: 'Meta Pixel ID' })
  @IsOptional()
  @IsString()
  meta_pixel_id?: string;

  @ApiPropertyOptional({ description: 'Meta Conversions API access token' })
  @IsOptional()
  @IsString()
  meta_access_token?: string;

  @ApiPropertyOptional({ description: 'Enable GA4 forwarding' })
  @IsOptional()
  ga4_enabled?: boolean;

  @ApiPropertyOptional({ description: 'Enable Meta forwarding' })
  @IsOptional()
  meta_enabled?: boolean;
}

export interface TrackingConfig {
  ga4_measurement_id?: string;
  ga4_api_secret?: string;
  ga4_enabled: boolean;
  meta_pixel_id?: string;
  meta_access_token?: string;
  meta_enabled: boolean;
}
