# Deploy Runbook — VPS Production Setup

This runbook covers the full process of setting up a fresh Ubuntu 22.04 VPS and deploying the ecommerce platform from scratch, including Docker, Traefik, SSL/TLS via Let's Encrypt, and the first application deploy.

---

## Prerequisites

- A VPS running Ubuntu 22.04 LTS (minimum 2 vCPU, 4 GB RAM, 40 GB SSD)
- A domain name with DNS A records pointing to the VPS IP:
  - `api.yourdomain.com` → VPS IP
  - `yourdomain.com` (and `www.yourdomain.com`) → VPS IP
- SSH access to the VPS as a user with `sudo` privileges
- The GitHub repository forked or cloned under your account

---

## 1. Initial Server Setup

```bash
# Update system packages
sudo apt-get update && sudo apt-get upgrade -y

# Install essential packages
sudo apt-get install -y \
  curl \
  git \
  htop \
  ufw \
  ca-certificates \
  gnupg \
  lsb-release \
  postgresql-client \
  openssl \
  awscli

# Create a deploy user (optional but recommended)
sudo useradd -m -s /bin/bash deploy
sudo usermod -aG sudo deploy
sudo usermod -aG docker deploy   # after Docker is installed

# Set up SSH for the deploy user
sudo mkdir -p /home/deploy/.ssh
sudo cp ~/.ssh/authorized_keys /home/deploy/.ssh/
sudo chown -R deploy:deploy /home/deploy/.ssh
sudo chmod 700 /home/deploy/.ssh
sudo chmod 600 /home/deploy/.ssh/authorized_keys
```

---

## 2. Configure UFW Firewall

```bash
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
sudo ufw status
```

Only ports 22 (SSH), 80 (HTTP), and 443 (HTTPS) need to be public. All application ports (3000, 4000, etc.) are internal to Docker's network and are not exposed directly.

---

## 3. Install Docker Engine

```bash
# Add Docker's official GPG key
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
  | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

# Add the Docker repository
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
  https://download.docker.com/linux/ubuntu \
  $(lsb_release -cs) stable" \
  | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Install Docker Engine and the Compose plugin
sudo apt-get update
sudo apt-get install -y \
  docker-ce \
  docker-ce-cli \
  containerd.io \
  docker-buildx-plugin \
  docker-compose-plugin

# Add your user to the docker group
sudo usermod -aG docker $USER
newgrp docker

# Verify installation
docker --version
docker compose version
```

---

## 4. Create Directory Structure

```bash
sudo mkdir -p /opt/ecommerce
sudo mkdir -p /backups
sudo chown -R deploy:deploy /opt/ecommerce /backups
```

---

## 5. Clone the Repository

```bash
cd /opt/ecommerce
git clone https://github.com/YOUR_ORG/ecommerce.git .

# Or if the directory already has content:
git init
git remote add origin https://github.com/YOUR_ORG/ecommerce.git
git pull origin main
```

---

## 6. Configure Environment Variables

```bash
cp .env.example .env
nano .env
```

Set all required production values. Critical secrets that MUST be changed from defaults:

| Variable | Requirement |
|----------|-------------|
| `POSTGRES_PASSWORD` | Strong random password, min 32 chars |
| `REDIS_PASSWORD` | Strong random password |
| `JWT_SECRET` | Random string, min 32 chars |
| `JWT_REFRESH_SECRET` | Random string, min 32 chars (different from JWT_SECRET) |
| `ADMIN_JWT_SECRET` | Random string, min 32 chars |
| `MASTER_ENCRYPTION_KEY` | Exactly 32 hex characters |
| `BACKUP_ENCRYPTION_KEY` | Exactly 32 hex characters |
| `MEILI_MASTER_KEY` | Strong random string |
| `APP_URL` | Your production domain, e.g. `https://yourdomain.com` |
| `API_URL` | Your production API URL, e.g. `https://api.yourdomain.com` |
| `RESEND_API_KEY` | Valid Resend API key |
| `EMAIL_FROM` | Verified sender address |

Generate strong secrets with:

```bash
openssl rand -hex 32
```

---

## 7. Set Up Traefik as Reverse Proxy

Traefik handles TLS termination via Let's Encrypt and routes traffic to the correct containers based on labels.

### 7.1 Create Traefik configuration directories

```bash
sudo mkdir -p /opt/traefik
sudo touch /opt/traefik/acme.json
sudo chmod 600 /opt/traefik/acme.json
```

### 7.2 Create `/opt/traefik/traefik.yml`

```yaml
api:
  dashboard: true
  insecure: false

entryPoints:
  web:
    address: ":80"
    http:
      redirections:
        entryPoint:
          to: websecure
          scheme: https
          permanent: true
  websecure:
    address: ":443"

providers:
  docker:
    endpoint: "unix:///var/run/docker.sock"
    exposedByDefault: false
    network: traefik-public

certificatesResolvers:
  letsencrypt:
    acme:
      email: admin@yourdomain.com
      storage: /acme.json
      httpChallenge:
        entryPoint: web

log:
  level: INFO

accessLog: {}
```

Replace `admin@yourdomain.com` with your real email. Let's Encrypt sends renewal warnings to this address.

### 7.3 Create the Traefik Docker network

```bash
docker network create traefik-public
```

### 7.4 Create `/opt/traefik/docker-compose.yml`

```yaml
services:
  traefik:
    image: traefik:v3.0
    container_name: traefik
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
      - /opt/traefik/traefik.yml:/traefik.yml:ro
      - /opt/traefik/acme.json:/acme.json
    networks:
      - traefik-public
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.traefik-dashboard.rule=Host(`traefik.yourdomain.com`)"
      - "traefik.http.routers.traefik-dashboard.entrypoints=websecure"
      - "traefik.http.routers.traefik-dashboard.tls.certresolver=letsencrypt"
      - "traefik.http.routers.traefik-dashboard.service=api@internal"
      - "traefik.http.routers.traefik-dashboard.middlewares=auth"
      - "traefik.http.middlewares.auth.basicauth.users=admin:$$apr1$$..."

networks:
  traefik-public:
    external: true
```

Generate the basicauth password hash with:

```bash
htpasswd -nb admin yourpassword
# Escape $ as $$ in the docker-compose file
```

### 7.5 Start Traefik

```bash
cd /opt/traefik
docker compose up -d
docker logs traefik --follow
```

Verify Traefik is running and that the ACME challenge is working by checking logs for certificate issuance.

---

## 8. Verify Docker Compose Labels in Production Config

The production Docker Compose file at `infra/compose/docker-compose.prod.yml` must include Traefik labels for the `web` and `api` services. Confirm the following are set correctly:

```yaml
# In the 'web' service:
labels:
  - "traefik.enable=true"
  - "traefik.http.routers.web.rule=Host(`yourdomain.com`) || Host(`www.yourdomain.com`)"
  - "traefik.http.routers.web.entrypoints=websecure"
  - "traefik.http.routers.web.tls.certresolver=letsencrypt"
  - "traefik.http.services.web.loadbalancer.server.port=3000"

# In the 'api' service:
labels:
  - "traefik.enable=true"
  - "traefik.http.routers.api.rule=Host(`api.yourdomain.com`)"
  - "traefik.http.routers.api.entrypoints=websecure"
  - "traefik.http.routers.api.tls.certresolver=letsencrypt"
  - "traefik.http.services.api.loadbalancer.server.port=4000"
```

---

## 9. First Deploy

### 9.1 Authenticate with GitHub Container Registry

```bash
echo $GITHUB_PAT | docker login ghcr.io -u YOUR_GITHUB_USERNAME --password-stdin
```

### 9.2 Pull and start all services

```bash
cd /opt/ecommerce
docker compose -f infra/compose/docker-compose.prod.yml pull
docker compose -f infra/compose/docker-compose.prod.yml up -d
```

### 9.3 Run database migrations

```bash
docker compose -f infra/compose/docker-compose.prod.yml exec api npx prisma migrate deploy
```

### 9.4 Seed initial data

Run this only on the first deploy. It creates the admin user, default categories, shipping zones, and demo products.

```bash
docker compose -f infra/compose/docker-compose.prod.yml exec api npx ts-node prisma/seed.ts
```

### 9.5 Verify all services are healthy

```bash
docker compose -f infra/compose/docker-compose.prod.yml ps
```

All services should show `Up (healthy)` or `Up`. Check logs for any errors:

```bash
docker compose -f infra/compose/docker-compose.prod.yml logs api --tail=50
docker compose -f infra/compose/docker-compose.prod.yml logs web --tail=50
docker compose -f infra/compose/docker-compose.prod.yml logs worker --tail=50
```

### 9.6 Run smoke test

```bash
API_URL=https://api.yourdomain.com WEB_URL=https://yourdomain.com bash scripts/smoke-test.sh
```

---

## 10. Set Up Automated Backups

See the [Backup Runbook](./backup-restore.md) for cron setup.

Quick setup:

```bash
# Copy backup script
chmod +x /opt/ecommerce/scripts/backup.sh

# Add cron job for daily backups at 3:00 AM UTC
(crontab -l 2>/dev/null; echo "0 3 * * * /opt/ecommerce/scripts/backup.sh >> /var/log/ecommerce-backup.log 2>&1") | crontab -
```

---

## 11. Configure GitHub Actions Secrets

In your GitHub repository settings under `Settings > Secrets and Variables > Actions`, add:

| Secret | Value |
|--------|-------|
| `VPS_HOST` | Your VPS IP address or hostname |
| `VPS_USER` | SSH username (e.g., `deploy`) |
| `VPS_SSH_KEY` | Contents of the private SSH key (`~/.ssh/id_ed25519`) |

The `GITHUB_TOKEN` secret is automatically provided by GitHub Actions for pushing to the GitHub Container Registry (ghcr.io).

---

## 12. SSL/TLS Verification

After the first deploy, verify TLS is working correctly:

```bash
# Check certificate details
curl -vI https://yourdomain.com 2>&1 | grep -E "SSL|issuer|subject|expire"

# Check certificate expiry
echo | openssl s_client -connect yourdomain.com:443 -servername yourdomain.com 2>/dev/null \
  | openssl x509 -noout -dates
```

Traefik automatically renews Let's Encrypt certificates 30 days before expiry. No manual intervention is required.

---

## 13. Ongoing Deploys

After the first deploy, subsequent deploys happen automatically when you push to the `main` branch. The GitHub Actions workflow at `.github/workflows/deploy-prod.yml` handles:

1. Building and pushing Docker images to ghcr.io
2. SSH-ing into the VPS
3. Pulling new images
4. Running `docker compose up -d --remove-orphans`
5. Running `prisma migrate deploy`
6. Running the smoke test

To manually trigger a deploy from the VPS:

```bash
cd /opt/ecommerce
bash scripts/deploy.sh
```

---

## Troubleshooting

### Service not starting

```bash
# Check logs
docker compose -f infra/compose/docker-compose.prod.yml logs <service> --tail=100

# Inspect a container
docker inspect ecommerce-api-1
```

### Database connection refused

Verify PostgreSQL is healthy and the `DATABASE_URL` in `.env` uses the Docker service name (`postgres`), not `localhost`:

```bash
docker compose -f infra/compose/docker-compose.prod.yml exec api \
  npx prisma db execute --stdin <<< "SELECT 1"
```

### Traefik not issuing certificates

- Ensure ports 80 and 443 are open in UFW.
- Ensure DNS A records are propagated (`dig yourdomain.com`).
- Check Traefik logs: `docker logs traefik --follow`.
- Verify `/opt/traefik/acme.json` has permissions `600`.

## Demo con ngrok

Para exponer localmente el proyecto durante demos o pruebas de webhooks:

```bash
# Exponer solo el frontend
ngrok http 3000

# Exponer ambos servicios (requiere ngrok.yml configurado)
ngrok start --all
```

Ejemplo de `ngrok.yml` para ambos servicios:

```yaml
tunnels:
  web:
    addr: 3000
    proto: http
  api:
    addr: 3001
    proto: http
```

> Actualiza las variables `APP_URL` y `API_URL` en `.env` con las URLs que genere ngrok para que los webhooks apunten correctamente.

---

### Out of disk space

```bash
# Check disk usage
df -h

# Remove old Docker images
docker image prune -a --filter "until=168h"

# Remove old backups beyond retention period
find /backups -name "*.enc" -mtime +30 -delete
```
