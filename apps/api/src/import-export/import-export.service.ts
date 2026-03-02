import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { PrismaService } from '../prisma/prisma.service';

const REQUIRED_HEADERS = ['name', 'sku', 'price', 'stock', 'category'] as const;
type RequiredHeader = (typeof REQUIRED_HEADERS)[number];

export interface CsvRow {
  name: string;
  sku: string;
  price: string;
  stock: string;
  category: string;
  [key: string]: string;
}

export interface ImportJob {
  id: string;
  status: string;
  fileName: string;
  totalRows: number;
  processedRows: number;
  failedRows: number;
  errors: unknown;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class ImportExportService {
  private readonly logger = new Logger(ImportExportService.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue('import-export') private readonly importExportQueue: Queue,
  ) {}

  /**
   * Parses a CSV buffer into rows.
   * Validates that required headers are present.
   * Returns the parsed rows (all as strings).
   */
  parseCsv(buffer: Buffer): { headers: string[]; rows: CsvRow[] } {
    const text = buffer.toString('utf-8');
    const lines = text
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    if (lines.length < 2) {
      throw new BadRequestException('CSV must have a header row and at least one data row');
    }

    const headers = lines[0]!.split(',').map((h) => h.trim().toLowerCase());

    // Validate required headers
    const missing: string[] = [];
    for (const required of REQUIRED_HEADERS) {
      if (!headers.includes(required)) {
        missing.push(required);
      }
    }
    if (missing.length > 0) {
      throw new BadRequestException(
        `CSV is missing required columns: ${missing.join(', ')}. Required: ${REQUIRED_HEADERS.join(', ')}`,
      );
    }

    const rows: CsvRow[] = [];
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i]!.split(',').map((v) => v.trim());
      const row: Record<string, string> = {};
      headers.forEach((header, idx) => {
        row[header] = values[idx] ?? '';
      });
      rows.push(row as CsvRow);
    }

    return { headers, rows };
  }

  /**
   * Creates an ImportJob record in the DB and enqueues a BullMQ job.
   * Returns the jobId and preview of first 5 rows.
   */
  async createImportJob(
    buffer: Buffer,
    originalName: string,
  ): Promise<{ jobId: string; preview: CsvRow[]; totalRows: number }> {
    const { rows } = this.parseCsv(buffer);
    const preview = rows.slice(0, 5);

    const job = await (this.prisma as any).importJob.create({
      data: {
        fileName: originalName,
        status: 'PENDING',
        totalRows: rows.length,
        processedRows: 0,
        failedRows: 0,
        errors: [],
      },
    });

    await this.importExportQueue.add(
      'process-product-import',
      {
        jobId: job.id,
        rows,
        fileName: originalName,
      },
      {
        attempts: 2,
        backoff: { type: 'fixed', delay: 5000 },
        removeOnComplete: 50,
        removeOnFail: 100,
      },
    );

    this.logger.log(`Created import job ${job.id} for file ${originalName} (${rows.length} rows)`);

    return { jobId: job.id, preview, totalRows: rows.length };
  }

  async listImportJobs(page = 1, limit = 20): Promise<{ data: ImportJob[]; total: number }> {
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      (this.prisma as any).importJob.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      (this.prisma as any).importJob.count(),
    ]);
    return { data, total };
  }

  async getImportJob(jobId: string): Promise<ImportJob> {
    const job = await (this.prisma as any).importJob.findUnique({
      where: { id: jobId },
    });
    if (!job) throw new NotFoundException(`Import job ${jobId} not found`);
    return job as ImportJob;
  }

  /**
   * Exports all active products as a CSV string.
   */
  async exportProductsCsv(): Promise<string> {
    const products = await (this.prisma as any).product.findMany({
      where: { status: 'ACTIVE' },
      include: {
        category: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const csvHeaders = ['name', 'sku', 'price', 'stock', 'category', 'status'];
    const lines: string[] = [csvHeaders.join(',')];

    for (const product of products) {
      const row = [
        this.escapeCsvValue(product.name ?? ''),
        this.escapeCsvValue(product.sku ?? ''),
        String(product.price ?? 0),
        String(product.stock ?? 0),
        this.escapeCsvValue(product.category?.name ?? ''),
        this.escapeCsvValue(product.status ?? 'ACTIVE'),
      ];
      lines.push(row.join(','));
    }

    return lines.join('\n');
  }

  private escapeCsvValue(value: string): string {
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  }
}
