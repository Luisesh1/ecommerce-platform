# Backup and Restore Runbook

This runbook documents all procedures for backing up and restoring the ecommerce platform's PostgreSQL database. Backups are encrypted with AES-256-CBC and optionally uploaded to S3-compatible storage (MinIO or AWS S3).

---

## Overview

The backup system uses `pg_dump` to produce a plain-SQL dump, then encrypts it with OpenSSL using AES-256-CBC with PBKDF2 key derivation (100,000 iterations). A SHA-256 checksum is computed from the encrypted file before any S3 upload. Restoration decrypts the file, verifies the checksum, and pipes the SQL into `psql`.

Scripts:
- `scripts/backup.sh` — creates a timestamped encrypted backup
- `scripts/restore.sh` — decrypts and restores a backup file

---

## Environment Variables

These variables are read from `/opt/ecommerce/.env` by the backup scripts. Ensure they are set before running any backup or restore procedure.

| Variable | Description | Default |
|----------|-------------|---------|
| `POSTGRES_HOST` | PostgreSQL host | `localhost` |
| `POSTGRES_PORT` | PostgreSQL port | `5432` |
| `POSTGRES_USER` | PostgreSQL username | `ecommerce` |
| `POSTGRES_PASSWORD` | PostgreSQL password | required |
| `POSTGRES_DB` | Database name | `ecommerce` |
| `BACKUP_DIR` | Local directory for backup files | `/backups` |
| `BACKUP_ENCRYPTION_KEY` | AES-256 passphrase for encrypting dumps | required |
| `BACKUP_RETENTION_DAYS` | Days to retain local backup files | `7` |
| `BACKUP_S3_BUCKET` | S3 bucket name (optional) | — |
| `BACKUP_S3_ENDPOINT` | S3 endpoint URL for MinIO (optional) | — |

---

## Manual Backup

To create a backup on demand:

```bash
cd /opt/ecommerce
bash scripts/backup.sh
```

The script produces two files in `$BACKUP_DIR`:

```
/backups/backup_20260301_030000.sql.enc        # encrypted dump
/backups/backup_20260301_030000.sql.enc.sha256 # checksum
```

Check that the backup was created successfully:

```bash
ls -lh /backups/
# verify size is non-zero and timestamp matches
```

If S3 upload is configured (`BACKUP_S3_BUCKET` is set), the encrypted file is also uploaded there automatically.

---

## Automated Backup via Cron

Set up a cron job to run backups daily at 3:00 AM UTC:

```bash
# Open crontab for the deploy user
crontab -e
```

Add this line:

```cron
0 3 * * * /opt/ecommerce/scripts/backup.sh >> /var/log/ecommerce-backup.log 2>&1
```

Verify the cron is registered:

```bash
crontab -l
```

### Monitoring backup cron logs

```bash
tail -f /var/log/ecommerce-backup.log
```

A successful run ends with:

```
[2026-03-01 03:00:12] Backup completed successfully
```

### Setting up log rotation for backup logs

Create `/etc/logrotate.d/ecommerce-backup`:

```
/var/log/ecommerce-backup.log {
    daily
    rotate 14
    compress
    missingok
    notifempty
    create 0640 deploy deploy
}
```

---

## Restore Procedure

**Warning:** Restoring a backup overwrites all existing data in the target database. Always verify you are targeting the correct database before proceeding.

### Step 1: Identify the backup file to restore

```bash
ls -lh /backups/
```

Or list available backups in S3:

```bash
aws s3 ls s3://$BACKUP_S3_BUCKET/ --endpoint-url $BACKUP_S3_ENDPOINT
```

### Step 2: Download from S3 (if needed)

```bash
aws s3 cp \
  "s3://${BACKUP_S3_BUCKET}/backup_20260301_030000.sql.enc" \
  /backups/ \
  --endpoint-url "${BACKUP_S3_ENDPOINT}"

aws s3 cp \
  "s3://${BACKUP_S3_BUCKET}/backup_20260301_030000.sql.enc.sha256" \
  /backups/ \
  --endpoint-url "${BACKUP_S3_ENDPOINT}"
```

### Step 3: Stop the application services

To avoid write conflicts during restore, stop the API and Worker while keeping PostgreSQL running:

```bash
cd /opt/ecommerce
docker compose -f infra/compose/docker-compose.prod.yml stop api worker
```

### Step 4: Run the restore script

```bash
cd /opt/ecommerce
bash scripts/restore.sh /backups/backup_20260301_030000.sql.enc
```

The script will:
1. Verify the SHA-256 checksum (if `.sha256` file exists)
2. Decrypt the `.enc` file to a temporary `.restored.sql` file
3. Record the order count before restore
4. Execute the SQL dump with `psql`
5. Record the order count after restore
6. Delete the temporary decrypted file

### Step 5: Restart the application services

```bash
docker compose -f infra/compose/docker-compose.prod.yml start api worker
```

### Step 6: Verify the restore

```bash
# Check API health
curl -sf https://api.yourdomain.com/api/health | jq .

# Check application logs for errors
docker compose -f infra/compose/docker-compose.prod.yml logs api --tail=50

# Run smoke tests
API_URL=https://api.yourdomain.com WEB_URL=https://yourdomain.com bash scripts/smoke-test.sh
```

---

## Verification Steps

After any restore, perform these checks to confirm data integrity:

```bash
# Connect to the database
docker compose -f infra/compose/docker-compose.prod.yml exec postgres \
  psql -U ecommerce -d ecommerce

# Check table row counts
SELECT
  schemaname,
  relname AS table_name,
  n_live_tup AS row_count
FROM pg_stat_user_tables
ORDER BY n_live_tup DESC;

# Verify recent orders exist
SELECT id, status, created_at FROM orders ORDER BY created_at DESC LIMIT 10;

# Verify product catalog
SELECT COUNT(*) FROM products;
SELECT COUNT(*) FROM product_variants;

# Check for any null/corrupted critical fields
SELECT id FROM orders WHERE total_amount IS NULL;
```

---

## Disaster Recovery Scenarios

### Scenario 1: Database corruption or accidental data deletion

**Symptoms:** Queries fail with syntax errors, data is missing, or the database is in an inconsistent state.

**Steps:**
1. Immediately stop write traffic: `docker compose stop api worker`
2. Identify the most recent clean backup: `ls -lt /backups/*.enc | head -5`
3. If uncertain, check the backup timestamp vs. the incident time
4. Follow the restore procedure above
5. After restore, validate the data
6. Restart services

**RTO target:** 30 minutes
**RPO target:** 24 hours (daily backup cadence)

---

### Scenario 2: VPS total failure (disk corruption, provider issue)

**Symptoms:** Cannot SSH into the server; the VPS is completely unresponsive.

**Steps:**
1. Provision a new VPS (Ubuntu 22.04) with the same provider or another
2. Follow the [Deploy Runbook](./deploy.md) to configure Docker, Traefik, and the application
3. Update DNS A records to point to the new VPS IP
4. Download the most recent backup from S3:
   ```bash
   aws s3 cp s3://$BACKUP_S3_BUCKET/ /backups/ --recursive --endpoint-url $BACKUP_S3_ENDPOINT
   ```
5. Start PostgreSQL only:
   ```bash
   docker compose -f infra/compose/docker-compose.prod.yml up -d postgres
   ```
6. Restore the backup:
   ```bash
   bash scripts/restore.sh /backups/<latest>.sql.enc
   ```
7. Start all remaining services and run migrations:
   ```bash
   docker compose -f infra/compose/docker-compose.prod.yml up -d
   docker compose -f infra/compose/docker-compose.prod.yml exec api npx prisma migrate deploy
   ```
8. Run smoke tests

**RTO target:** 2-4 hours (includes DNS propagation)
**RPO target:** 24 hours (daily backup cadence)

---

### Scenario 3: Accidental table truncation or DROP TABLE

**Symptoms:** A table is empty or missing after an admin action or a bad migration.

**Steps:**
1. Stop write traffic immediately
2. Identify the table that was affected
3. If only one table is affected and a point-in-time restore is not available, restore the full dump and then manually extract the table:
   ```bash
   # Decrypt and inspect the backup
   openssl enc -d -aes-256-cbc -pbkdf2 -iter 100000 \
     -in /backups/backup_TIMESTAMP.sql.enc \
     -out /tmp/backup.sql \
     -k "$BACKUP_ENCRYPTION_KEY"

   # Extract specific table data
   grep -A 99999 "COPY public.orders" /tmp/backup.sql \
     | grep -B 99999 "^\\\." \
     > /tmp/orders_restore.sql

   # Import only that table's data
   psql -U ecommerce -d ecommerce -f /tmp/orders_restore.sql

   # Clean up
   rm /tmp/backup.sql /tmp/orders_restore.sql
   ```
4. Verify row counts
5. Restart services

---

### Scenario 4: Compromised encryption key

**Symptoms:** The `BACKUP_ENCRYPTION_KEY` has been exposed. Existing backups encrypted with this key must be considered insecure.

**Steps:**
1. Rotate the key in `.env`: generate a new 32-char hex key with `openssl rand -hex 32`
2. Re-encrypt all existing backups with the new key:
   ```bash
   OLD_KEY="old_key_here"
   NEW_KEY="new_key_here"

   for f in /backups/*.enc; do
     openssl enc -d -aes-256-cbc -pbkdf2 -iter 100000 -in "$f" -out "${f%.enc}.sql" -k "$OLD_KEY"
     openssl enc -aes-256-cbc -pbkdf2 -iter 100000 -in "${f%.enc}.sql" -out "${f}.new" -k "$NEW_KEY"
     sha256sum "${f}.new" > "${f}.new.sha256"
     rm -f "${f%.enc}.sql" "$f" "${f}.sha256"
     mv "${f}.new" "$f"
     mv "${f}.new.sha256" "${f}.sha256"
   done
   ```
3. Update S3-stored backups with the re-encrypted versions
4. Update `BACKUP_ENCRYPTION_KEY` in the deployment secrets (GitHub Actions and VPS `.env`)

---

## Backup File Naming Convention

```
backup_YYYYMMDD_HHMMSS.sql.enc
backup_YYYYMMDD_HHMMSS.sql.enc.sha256
```

Example:
```
backup_20260301_030012.sql.enc
backup_20260301_030012.sql.enc.sha256
```

---

## Retention Policy

| Location | Retention |
|----------|-----------|
| Local (`/backups/`) | 7 days (configurable via `BACKUP_RETENTION_DAYS`) |
| S3 / MinIO | Managed separately; configure S3 lifecycle rules |

Recommended S3 lifecycle rules:
- Move backups to S3 Glacier after 30 days
- Expire Glacier backups after 90 days
