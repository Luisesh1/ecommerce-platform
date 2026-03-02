import {
  Controller,
  Post,
  Get,
  Param,
  Query,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
  Res,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
import { Response } from 'express';
import { ImportExportService } from './import-export.service';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@ApiTags('Admin - Import / Export')
@ApiBearerAuth()
@Roles(UserRole.ADMIN, UserRole.SUPPORT)
@Controller('api/admin')
export class ImportExportController {
  constructor(private readonly importExportService: ImportExportService) {}

  @ApiOperation({ summary: 'Upload a CSV file to import products' })
  @ApiConsumes('multipart/form-data')
  @HttpCode(HttpStatus.ACCEPTED)
  @Post('import/products')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
      fileFilter: (_req, file, cb) => {
        if (!file.originalname.match(/\.(csv)$/i)) {
          return cb(new BadRequestException('Only CSV files are allowed'), false);
        }
        cb(null, true);
      },
    }),
  )
  async importProducts(
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('No file uploaded. Use field name "file".');
    }
    return this.importExportService.createImportJob(file.buffer, file.originalname);
  }

  @ApiOperation({ summary: 'List all import jobs' })
  @Get('import/jobs')
  async listImportJobs(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.importExportService.listImportJobs(
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20,
    );
  }

  @ApiOperation({ summary: 'Get a single import job with error details' })
  @Get('import/jobs/:id')
  async getImportJob(@Param('id') id: string) {
    return this.importExportService.getImportJob(id);
  }

  @ApiOperation({ summary: 'Export all active products as CSV' })
  @Get('export/products')
  async exportProducts(@Res() res: Response) {
    const csv = await this.importExportService.exportProductsCsv();
    const filename = `products-export-${new Date().toISOString().split('T')[0]}.csv`;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  }
}
