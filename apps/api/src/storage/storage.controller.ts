import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Query,
  UploadedFile,
  UseInterceptors,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes, ApiBody, ApiQuery } from '@nestjs/swagger';
import { StorageService } from './storage.service';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@ApiTags('Storage')
@ApiBearerAuth()
@Controller('storage')
export class StorageController {
  constructor(private readonly storageService: StorageService) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Upload a file' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
        folder: { type: 'string', example: 'products' },
      },
    },
  })
  uploadFile(
    @UploadedFile() file: Express.Multer.File,
    @Body('folder') folder: string = 'uploads',
  ) {
    return this.storageService.uploadFile(file, folder);
  }

  @Get('presigned-url')
  @ApiOperation({ summary: 'Get presigned URL for direct upload' })
  @ApiQuery({ name: 'key', required: true })
  @ApiQuery({ name: 'expiresIn', required: false, type: Number })
  getPresignedUrl(
    @Query('key') key: string,
    @Query('expiresIn') expiresIn?: string,
  ) {
    return this.storageService.getSignedUrl(key, expiresIn ? parseInt(expiresIn) : 3600);
  }

  @Delete('files')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a file (admin)' })
  deleteFile(@Body() body: { key: string }) {
    return this.storageService.deleteFile(body.key);
  }
}
