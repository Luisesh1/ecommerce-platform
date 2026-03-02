import { Process, Processor, OnQueueFailed } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { PrismaService } from '../prisma.service';
import { ConfigService } from '@nestjs/config';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import * as csv from 'csv-parser';
import { Readable } from 'stream';

export interface ImportJobData {
  importJobId: string;
}

interface ProductCsvRow {
  name: string;
  slug: string;
  sku: string;
  description?: string;
  price: string;         // e.g. "199.99" — will be converted to cents
  compareAtPrice?: string;
  stock: string;
  category?: string;
  brand?: string;
  status?: string;
  tags?: string;         // comma-separated
  images?: string;       // comma-separated URLs
  weight?: string;
  barcode?: string;
}

@Processor('import-export')
export class ImportExportProcessor {
  private readonly logger = new Logger(ImportExportProcessor.name);
  private readonly s3: S3Client;
  private readonly bucket: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    const endpoint = this.configService.get<string>('MINIO_ENDPOINT');
    const port = this.configService.get<number>('MINIO_PORT', 9000);
    const useSSL = this.configService.get<string>('MINIO_USE_SSL', 'false') === 'true';

    this.s3 = new S3Client({
      region: this.configService.get<string>('AWS_REGION', 'us-east-1'),
      endpoint: endpoint
        ? `${useSSL ? 'https' : 'http'}://${endpoint}:${port}`
        : undefined,
      forcePathStyle: Boolean(endpoint), // required for MinIO
      credentials: {
        accessKeyId: this.configService.get<string>('MINIO_ACCESS_KEY', ''),
        secretAccessKey: this.configService.get<string>('MINIO_SECRET_KEY', ''),
      },
    });

    this.bucket = this.configService.get<string>('MINIO_BUCKET', 'ecommerce');
  }

  @Process('process-import')
  async handleProcessImport(job: Job<ImportJobData>): Promise<void> {
    const { importJobId } = job.data;

    this.logger.log(`Processing import job ${importJobId}`);

    // 1. Fetch the ImportJob record
    const importJob = await this.prisma.importJob.findUnique({
      where: { id: importJobId },
    });

    if (!importJob) {
      this.logger.error(`ImportJob ${importJobId} not found`);
      return;
    }

    if (importJob.status !== 'PENDING' && importJob.status !== 'QUEUED') {
      this.logger.warn(`ImportJob ${importJobId} is already ${importJob.status} — skipping`);
      return;
    }

    // 2. Mark as processing
    await this.prisma.importJob.update({
      where: { id: importJobId },
      data: { status: 'PROCESSING', startedAt: new Date() },
    });

    let processedRows = 0;
    let successCount = 0;
    let errorCount = 0;
    const errors: Array<{ row: number; message: string }> = [];

    try {
      // 3. Download CSV from S3/MinIO
      const csvStream = await this.downloadCsv(importJob.fileKey);

      // 4. Parse and process rows
      const rows = await this.parseCsv(csvStream);
      const totalRows = rows.length;

      this.logger.log(`ImportJob ${importJobId}: ${totalRows} rows to process`);

      await this.prisma.importJob.update({
        where: { id: importJobId },
        data: { totalRows },
      });

      for (const row of rows) {
        processedRows++;
        try {
          await this.processProductRow(row, importJob.type);
          successCount++;
        } catch (err) {
          errorCount++;
          const message = (err as Error).message;
          errors.push({ row: processedRows, message });
          this.logger.warn(`Row ${processedRows} error: ${message}`);
        }

        // Update progress every 10 rows
        if (processedRows % 10 === 0) {
          await this.prisma.importJob.update({
            where: { id: importJobId },
            data: {
              processedRows,
              successCount,
              errorCount,
            },
          });
          await job.progress(Math.round((processedRows / totalRows) * 100));
        }
      }

      // 5. Finalise
      await this.prisma.importJob.update({
        where: { id: importJobId },
        data: {
          status: errorCount > 0 && successCount === 0 ? 'FAILED' : 'COMPLETED',
          processedRows,
          successCount,
          errorCount,
          errors: errors.length > 0 ? JSON.stringify(errors) : null,
          completedAt: new Date(),
        },
      });

      this.logger.log(
        `ImportJob ${importJobId} complete: ${successCount} success, ${errorCount} errors`,
      );
    } catch (err) {
      const message = (err as Error).message;
      this.logger.error(`ImportJob ${importJobId} fatal error: ${message}`, (err as Error).stack);

      await this.prisma.importJob.update({
        where: { id: importJobId },
        data: {
          status: 'FAILED',
          processedRows,
          successCount,
          errorCount,
          errors: JSON.stringify([...errors, { row: processedRows, message }]),
          completedAt: new Date(),
        },
      });

      throw err;
    }
  }

  // ─── Private helpers ────────────────────────────────────────────────────────

  private async downloadCsv(fileKey: string): Promise<Readable> {
    const command = new GetObjectCommand({ Bucket: this.bucket, Key: fileKey });
    const response = await this.s3.send(command);
    if (!response.Body) {
      throw new Error(`Empty response body for key: ${fileKey}`);
    }
    // AWS SDK v3 returns a SdkStream — convert to Node Readable
    return response.Body as Readable;
  }

  private parseCsv(stream: Readable): Promise<ProductCsvRow[]> {
    return new Promise((resolve, reject) => {
      const rows: ProductCsvRow[] = [];
      stream
        .pipe(csv({ trim: true, skipLines: 0 }))
        .on('data', (row: ProductCsvRow) => rows.push(row))
        .on('end', () => resolve(rows))
        .on('error', (err) => reject(err));
    });
  }

  private async processProductRow(row: ProductCsvRow, type: string): Promise<void> {
    if (type === 'products') {
      await this.upsertProduct(row);
    } else {
      throw new Error(`Unsupported import type: ${type}`);
    }
  }

  private async upsertProduct(row: ProductCsvRow): Promise<void> {
    // Validate required fields
    if (!row.name?.trim()) throw new Error('Missing required field: name');
    if (!row.sku?.trim()) throw new Error('Missing required field: sku');
    if (!row.price?.trim()) throw new Error('Missing required field: price');

    const priceCents = Math.round(parseFloat(row.price) * 100);
    if (isNaN(priceCents) || priceCents < 0) {
      throw new Error(`Invalid price: "${row.price}"`);
    }

    const stockQuantity = parseInt(row.stock ?? '0', 10);
    if (isNaN(stockQuantity) || stockQuantity < 0) {
      throw new Error(`Invalid stock: "${row.stock}"`);
    }

    const compareAtPriceCents = row.compareAtPrice
      ? Math.round(parseFloat(row.compareAtPrice) * 100)
      : null;

    const slug =
      row.slug?.trim() ||
      row.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');

    // Resolve category if provided
    let categoryId: string | null = null;
    if (row.category?.trim()) {
      const category = await this.prisma.category.findFirst({
        where: { name: { equals: row.category.trim(), mode: 'insensitive' } },
      });
      categoryId = category?.id ?? null;
    }

    // Resolve brand if provided
    let brandId: string | null = null;
    if (row.brand?.trim()) {
      const brand = await this.prisma.brand.upsert({
        where: { name: row.brand.trim() },
        create: {
          name: row.brand.trim(),
          slug: row.brand.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        },
        update: {},
      });
      brandId = brand.id;
    }

    const status = (['ACTIVE', 'DRAFT', 'ARCHIVED'].includes(row.status?.toUpperCase() ?? '')
      ? row.status?.toUpperCase()
      : 'DRAFT') as 'ACTIVE' | 'DRAFT' | 'ARCHIVED';

    // Upsert the product by slug
    const product = await this.prisma.product.upsert({
      where: { slug },
      create: {
        name: row.name.trim(),
        slug,
        description: row.description?.trim() ?? null,
        status,
        categoryId,
        brandId,
      },
      update: {
        name: row.name.trim(),
        description: row.description?.trim() ?? null,
        status,
        categoryId,
        brandId,
      },
    });

    // Upsert the default variant by SKU
    await this.prisma.productVariant.upsert({
      where: { sku: row.sku.trim() },
      create: {
        productId: product.id,
        sku: row.sku.trim(),
        title: 'Default',
        priceCents,
        salePriceCents: compareAtPriceCents,
        stockQuantity,
        barcode: row.barcode?.trim() ?? null,
        weight: row.weight ? parseFloat(row.weight) : null,
        isActive: true,
      },
      update: {
        priceCents,
        salePriceCents: compareAtPriceCents,
        stockQuantity,
        barcode: row.barcode?.trim() ?? null,
        weight: row.weight ? parseFloat(row.weight) : null,
      },
    });

    // Sync tags
    if (row.tags?.trim()) {
      const tagNames = row.tags.split(',').map((t) => t.trim()).filter(Boolean);
      for (const tagName of tagNames) {
        const tag = await this.prisma.tag.upsert({
          where: { name: tagName },
          create: {
            name: tagName,
            slug: tagName.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
          },
          update: {},
        });
        await this.prisma.productTag.upsert({
          where: { productId_tagId: { productId: product.id, tagId: tag.id } },
          create: { productId: product.id, tagId: tag.id },
          update: {},
        });
      }
    }
  }

  @OnQueueFailed()
  onFailed(job: Job<ImportJobData>, error: Error): void {
    this.logger.error(
      `Import job ${job.id} failed after ${job.attemptsMade} attempt(s): ${error.message}`,
      error.stack,
    );
  }
}
