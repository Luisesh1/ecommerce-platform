import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { BackupStatus } from '@prisma/client';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';

const execAsync = promisify(exec);

export interface BackupRunRecord {
  id: string;
  filename: string;
  size: number | null;
  status: BackupStatus;
  location: string | null;
  checksum: string | null;
  error: string | null;
  startedAt: string;
  completedAt: string | null;
}

@Injectable()
export class BackupService {
  private readonly logger = new Logger(BackupService.name);

  private readonly ENCRYPTION_KEY: Buffer;
  private readonly BACKUP_DIR: string;
  private readonly DATABASE_URL: string;
  private readonly CONFIRM_TOKEN = 'CONFIRM';

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    const encKeyHex = this.configService.get<string>(
      'BACKUP_ENCRYPTION_KEY',
      '0000000000000000000000000000000000000000000000000000000000000000',
    );
    this.ENCRYPTION_KEY = Buffer.from(encKeyHex.padEnd(64, '0').substring(0, 64), 'hex');
    this.BACKUP_DIR = this.configService.get<string>('BACKUP_DIR', '/tmp/backups');
    this.DATABASE_URL = this.configService.get<string>('DATABASE_URL', '');
  }

  // ─── PUBLIC API ───────────────────────────────────────────────────────

  async listBackups() {
    return this.prisma.backupRun.findMany({
      orderBy: { startedAt: 'desc' },
    });
  }

  async triggerBackup(): Promise<BackupRunRecord> {
    const id = uuidv4();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `backup-${timestamp}.pgdump.enc`;

    // Create initial record in DB
    const record = await this.prisma.backupRun.create({
      data: {
        id,
        filename,
        status: BackupStatus.RUNNING,
      },
    });

    // Run backup async (don't await the full process)
    this.runBackupProcess(id, filename).catch((err) => {
      this.logger.error(`Backup ${id} failed: ${(err as Error).message}`, (err as Error).stack);
    });

    return this.toRecord(record);
  }

  async restore(id: string, confirmToken: string): Promise<{ message: string }> {
    if (confirmToken !== this.CONFIRM_TOKEN) {
      throw new BadRequestException(
        `Invalid confirm token. Pass { confirmToken: "${this.CONFIRM_TOKEN}" } to proceed.`,
      );
    }

    const backup = await this.prisma.backupRun.findUnique({ where: { id } });
    if (!backup) {
      throw new NotFoundException(`Backup run ${id} not found`);
    }

    if (backup.status !== BackupStatus.COMPLETED) {
      throw new BadRequestException(`Cannot restore from backup with status: ${backup.status}`);
    }

    if (!backup.location) {
      throw new BadRequestException('Backup has no location; file may have been deleted');
    }

    // Run restore in background
    this.runRestoreProcess(backup.location).catch((err) => {
      this.logger.error(`Restore of ${id} failed: ${(err as Error).message}`);
    });

    return { message: `Restore from backup ${id} initiated. Monitor server logs for progress.` };
  }

  // ─── INTERNALS ────────────────────────────────────────────────────────

  private async runBackupProcess(id: string, filename: string): Promise<void> {
    const outputPath = path.join(this.BACKUP_DIR, filename);

    try {
      // Ensure backup dir exists
      await fs.promises.mkdir(this.BACKUP_DIR, { recursive: true });

      // Parse DATABASE_URL to extract connection info for pg_dump
      const dumpPath = outputPath.replace('.enc', '');
      const pgDumpCmd = this.buildPgDumpCommand(dumpPath);

      this.logger.log(`Starting pg_dump for backup ${id}`);
      await execAsync(pgDumpCmd, { env: { ...process.env, DATABASE_URL: this.DATABASE_URL } });

      // Encrypt the dump file
      this.logger.log(`Encrypting backup ${id}`);
      await this.encryptFile(dumpPath, outputPath);

      // Remove unencrypted dump
      await fs.promises.unlink(dumpPath).catch(() => {});

      // Compute checksum and size of encrypted file
      const stat = await fs.promises.stat(outputPath);
      const checksum = await this.computeChecksum(outputPath);

      await this.prisma.backupRun.update({
        where: { id },
        data: {
          status: BackupStatus.COMPLETED,
          location: outputPath,
          size: stat.size,
          checksum,
          completedAt: new Date(),
        },
      });

      this.logger.log(`Backup ${id} completed successfully: ${outputPath} (${stat.size} bytes)`);
    } catch (err) {
      await this.prisma.backupRun.update({
        where: { id },
        data: {
          status: BackupStatus.FAILED,
          error: (err as Error).message,
          completedAt: new Date(),
        },
      });
      throw err;
    }
  }

  private buildPgDumpCommand(outputPath: string): string {
    // pg_dump reads DATABASE_URL from environment when using --dbname with the full URL
    return `pg_dump --dbname="${this.DATABASE_URL}" --format=custom --no-password --file="${outputPath}"`;
  }

  private async encryptFile(inputPath: string, outputPath: string): Promise<void> {
    const iv = crypto.randomBytes(12); // 96-bit IV for AES-GCM
    const cipher = crypto.createCipheriv('aes-256-gcm', this.ENCRYPTION_KEY, iv);

    const input = fs.createReadStream(inputPath);
    const output = fs.createWriteStream(outputPath);

    await new Promise<void>((resolve, reject) => {
      // Write IV at the beginning of the file (12 bytes)
      output.write(iv, (err) => {
        if (err) return reject(err);

        input.pipe(cipher).pipe(output);
        output.on('finish', () => {
          // Append GCM auth tag (16 bytes) at the end
          const authTag = cipher.getAuthTag();
          fs.appendFile(outputPath, authTag, (appendErr) => {
            if (appendErr) reject(appendErr);
            else resolve();
          });
        });
        output.on('error', reject);
        input.on('error', reject);
      });
    });
  }

  private async computeChecksum(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const hash = crypto.createHash('sha256');
      const input = fs.createReadStream(filePath);
      input.pipe(hash);
      hash.on('finish', () => resolve(hash.digest('hex')));
      hash.on('error', reject);
      input.on('error', reject);
    });
  }

  private async runRestoreProcess(encryptedPath: string): Promise<void> {
    const decryptedPath = encryptedPath.replace('.enc', '.restored');

    try {
      this.logger.warn(`Starting database restore from ${encryptedPath}`);
      await this.decryptFile(encryptedPath, decryptedPath);

      const restoreCmd = `pg_restore --dbname="${this.DATABASE_URL}" --clean --if-exists --no-password "${decryptedPath}"`;
      await execAsync(restoreCmd, { env: { ...process.env } });

      await fs.promises.unlink(decryptedPath).catch(() => {});
      this.logger.log(`Database restore from ${encryptedPath} completed`);
    } catch (err) {
      await fs.promises.unlink(decryptedPath).catch(() => {});
      this.logger.error(`Restore process failed: ${(err as Error).message}`);
      throw err;
    }
  }

  private async decryptFile(inputPath: string, outputPath: string): Promise<void> {
    const encrypted = await fs.promises.readFile(inputPath);

    const iv = encrypted.slice(0, 12);
    const authTag = encrypted.slice(encrypted.length - 16);
    const ciphertext = encrypted.slice(12, encrypted.length - 16);

    const decipher = crypto.createDecipheriv('aes-256-gcm', this.ENCRYPTION_KEY, iv);
    decipher.setAuthTag(authTag);

    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    await fs.promises.writeFile(outputPath, decrypted);
  }

  private toRecord(record: {
    id: string;
    filename: string;
    size: bigint | null;
    status: BackupStatus;
    location: string | null;
    checksum: string | null;
    error: string | null;
    startedAt: Date;
    completedAt: Date | null;
  }): BackupRunRecord {
    return {
      id: record.id,
      filename: record.filename,
      size: record.size !== null ? Number(record.size) : null,
      status: record.status,
      location: record.location,
      checksum: record.checksum,
      error: record.error,
      startedAt: record.startedAt.toISOString(),
      completedAt: record.completedAt ? record.completedAt.toISOString() : null,
    };
  }
}
