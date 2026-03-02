#!/usr/bin/env bash
set -euo pipefail

if [ $# -lt 1 ]; then
  echo "Usage: $0 <backup_file.enc>"
  exit 1
fi

ENCRYPTED_FILE="$1"
CHECKSUM_FILE="${ENCRYPTED_FILE}.sha256"
RESTORE_FILE="${ENCRYPTED_FILE%.enc}.restored.sql"

if [ -f /opt/ecommerce/.env ]; then
  source /opt/ecommerce/.env
fi

echo "[$(date)] Starting restore from: ${ENCRYPTED_FILE}"

# Verify checksum
if [ -f "$CHECKSUM_FILE" ]; then
  echo "[$(date)] Verifying checksum..."
  sha256sum --check "$CHECKSUM_FILE"
  echo "[$(date)] Checksum OK"
else
  echo "[$(date)] WARNING: No checksum file found, proceeding without verification"
fi

# Decrypt
BACKUP_ENCRYPTION_KEY="${BACKUP_ENCRYPTION_KEY:-changeme}"
openssl enc -d -aes-256-cbc -pbkdf2 -iter 100000 \
  -in "$ENCRYPTED_FILE" \
  -out "$RESTORE_FILE" \
  -k "$BACKUP_ENCRYPTION_KEY"

echo "[$(date)] Decrypted backup to: ${RESTORE_FILE}"

# Count rows before restore
BEFORE_COUNT=$(PGPASSWORD="${POSTGRES_PASSWORD}" psql \
  -h "${POSTGRES_HOST:-localhost}" \
  -p "${POSTGRES_PORT:-5432}" \
  -U "${POSTGRES_USER:-ecommerce}" \
  -d "${POSTGRES_DB:-ecommerce}" \
  -t -c "SELECT COUNT(*) FROM orders;" 2>/dev/null | tr -d ' ' || echo "0")
echo "[$(date)] Orders before restore: ${BEFORE_COUNT}"

# Restore
PGPASSWORD="${POSTGRES_PASSWORD}" psql \
  -h "${POSTGRES_HOST:-localhost}" \
  -p "${POSTGRES_PORT:-5432}" \
  -U "${POSTGRES_USER:-ecommerce}" \
  -d "${POSTGRES_DB:-ecommerce}" \
  -f "$RESTORE_FILE"

echo "[$(date)] Database restored"

# Verify row count
AFTER_COUNT=$(PGPASSWORD="${POSTGRES_PASSWORD}" psql \
  -h "${POSTGRES_HOST:-localhost}" \
  -p "${POSTGRES_PORT:-5432}" \
  -U "${POSTGRES_USER:-ecommerce}" \
  -d "${POSTGRES_DB:-ecommerce}" \
  -t -c "SELECT COUNT(*) FROM orders;" | tr -d ' ')
echo "[$(date)] Orders after restore: ${AFTER_COUNT}"

# Cleanup
rm -f "$RESTORE_FILE"

echo "[$(date)] Restore completed successfully"
