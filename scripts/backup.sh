#!/usr/bin/env bash
set -euo pipefail

# Load environment variables
if [ -f /opt/ecommerce/.env ]; then
  source /opt/ecommerce/.env
fi

BACKUP_DIR="${BACKUP_DIR:-/backups}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/backup_${TIMESTAMP}.sql"
ENCRYPTED_FILE="${BACKUP_FILE}.enc"
CHECKSUM_FILE="${ENCRYPTED_FILE}.sha256"

# Create backup directory
mkdir -p "$BACKUP_DIR"

echo "[$(date)] Starting database backup..."

# pg_dump
PGPASSWORD="${POSTGRES_PASSWORD}" pg_dump \
  -h "${POSTGRES_HOST:-localhost}" \
  -p "${POSTGRES_PORT:-5432}" \
  -U "${POSTGRES_USER:-ecommerce}" \
  -d "${POSTGRES_DB:-ecommerce}" \
  --no-owner \
  --no-acl \
  -F p \
  -f "$BACKUP_FILE"

echo "[$(date)] Database dumped to ${BACKUP_FILE} ($(du -sh "$BACKUP_FILE" | cut -f1))"

# Encrypt with AES-256-CBC
BACKUP_ENCRYPTION_KEY="${BACKUP_ENCRYPTION_KEY:-changeme}"
openssl enc -aes-256-cbc -pbkdf2 -iter 100000 \
  -in "$BACKUP_FILE" \
  -out "$ENCRYPTED_FILE" \
  -k "$BACKUP_ENCRYPTION_KEY"

# Create checksum
sha256sum "$ENCRYPTED_FILE" > "$CHECKSUM_FILE"

# Remove unencrypted backup
rm -f "$BACKUP_FILE"

FILE_SIZE=$(du -sh "$ENCRYPTED_FILE" | cut -f1)
CHECKSUM=$(cat "$CHECKSUM_FILE" | awk '{print $1}')

echo "[$(date)] Backup encrypted: ${ENCRYPTED_FILE} (${FILE_SIZE})"
echo "[$(date)] SHA256: ${CHECKSUM}"

# Optional: Upload to S3/MinIO
if [ -n "${BACKUP_S3_BUCKET:-}" ]; then
  aws s3 cp "$ENCRYPTED_FILE" "s3://${BACKUP_S3_BUCKET}/$(basename $ENCRYPTED_FILE)" \
    --endpoint-url "${BACKUP_S3_ENDPOINT:-}" \
    --no-progress
  echo "[$(date)] Uploaded to S3: s3://${BACKUP_S3_BUCKET}/$(basename $ENCRYPTED_FILE)"
fi

# Cleanup old backups (retain last N days)
RETENTION="${BACKUP_RETENTION_DAYS:-7}"
find "$BACKUP_DIR" -name "*.enc" -mtime +${RETENTION} -delete
find "$BACKUP_DIR" -name "*.sha256" -mtime +${RETENTION} -delete
echo "[$(date)] Cleaned up backups older than ${RETENTION} days"

echo "[$(date)] Backup completed successfully"
