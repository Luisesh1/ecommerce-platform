import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateFeatureFlagDto {
  @ApiProperty({ description: 'Whether this feature flag is enabled' })
  @IsBoolean()
  enabled: boolean;
}

export class CreateFeatureFlagDto {
  @ApiProperty({ description: 'Unique key for the feature flag (e.g. new_checkout)' })
  @IsString()
  @MaxLength(100)
  key: string;

  @ApiProperty({ description: 'Human-readable name' })
  @IsString()
  @MaxLength(255)
  name: string;

  @ApiPropertyOptional({ description: 'Optional description' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean;
}
