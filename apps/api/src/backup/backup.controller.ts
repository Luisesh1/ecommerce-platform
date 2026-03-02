import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { BackupService } from './backup.service';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import { IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

class RestoreDto {
  @ApiProperty({ description: 'Must be "CONFIRM" to proceed with restore', example: 'CONFIRM' })
  @IsString()
  confirmToken: string;
}

@ApiTags('Backup')
@ApiBearerAuth('access-token')
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
@Controller('admin/backups')
export class BackupController {
  constructor(private readonly backupService: BackupService) {}

  @Get()
  @ApiOperation({ summary: 'List all backup runs (admin)' })
  async listBackups() {
    return this.backupService.listBackups();
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Trigger a new database backup (admin)' })
  async triggerBackup() {
    return this.backupService.triggerBackup();
  }

  @Post(':id/restore')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Restore database from a backup run (admin, dangerous)',
    description: 'Requires body { confirmToken: "CONFIRM" }',
  })
  async restore(
    @Param('id') id: string,
    @Body() dto: RestoreDto,
  ) {
    return this.backupService.restore(id, dto.confirmToken);
  }
}
