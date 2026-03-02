#!/usr/bin/env bash
set -euo pipefail

COMPOSE_FILE="${COMPOSE_FILE:-infra/compose/docker-compose.prod.yml}"
PROJECT_DIR="${PROJECT_DIR:-/opt/ecommerce}"

echo "[$(date)] === Deploy Started ==="

cd "$PROJECT_DIR"

echo "[$(date)] Pulling latest images..."
docker compose -f "$COMPOSE_FILE" pull

echo "[$(date)] Starting services..."
docker compose -f "$COMPOSE_FILE" up -d --remove-orphans

echo "[$(date)] Running database migrations..."
docker compose -f "$COMPOSE_FILE" exec -T api npx prisma migrate deploy

echo "[$(date)] Waiting for services to stabilize..."
sleep 15

echo "[$(date)] Running smoke tests..."
bash scripts/smoke-test.sh

echo "[$(date)] === Deploy Complete ==="
