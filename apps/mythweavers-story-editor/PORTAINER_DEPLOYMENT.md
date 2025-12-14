# Portainer Stack Deployment Guide

This guide explains how to deploy the Story application using Portainer with Caddy Docker Proxy for automatic HTTPS.

## Prerequisites

1. **Portainer** installed and running
2. **Caddy Docker Proxy** running with a network named `caddy`
3. **Docker** and **Docker Compose** installed
4. A domain pointing to your server

## Setup Caddy Docker Proxy (if not already running)

```bash
# Create the Caddy network
docker network create caddy

# Run Caddy Docker Proxy
docker run -d \
  --name caddy \
  --restart unless-stopped \
  --network caddy \
  -p 80:80 \
  -p 443:443 \
  -v caddy_data:/data \
  -v /var/run/docker.sock:/var/run/docker.sock \
  lucaslorentz/caddy-docker-proxy:latest
```

## Deployment Steps

### 1. Prepare the Host

Create a directory for the SQLite database:
```bash
sudo mkdir -p /srv/docker/story/data
sudo chown 1000:1000 /srv/docker/story/data  # Adjust UID/GID as needed
```

### 2. Configure in Portainer

1. **Log into Portainer**
2. Go to **Stacks** → **Add Stack**
3. Name your stack: `story`

### 3. Set Environment Variables

In the **Environment variables** section, add:

| Variable | Value | Description |
|----------|-------|-------------|
| `DOMAIN` | `story.yourdomain.com` | Your frontend domain |
| `API_DOMAIN` | `api.story.yourdomain.com` | Your API domain |
| `DATA_PATH` | `/srv/docker/story/data` | Path on host for database |
| `ANTHROPIC_API_KEY` | `sk-ant-...` | Optional: Anthropic API key |
| `OPENROUTER_API_KEY` | `sk-or-...` | Optional: OpenRouter API key |

### 4. Add the Stack Configuration

Copy the contents of `docker-compose.portainer-simple.yml` into the **Web editor** in Portainer:

```yaml
version: '3.8'

services:
  backend:
    image: aeolun/story-backend:latest
    restart: unless-stopped
    volumes:
      - ${DATA_PATH:-/srv/docker/story/data}:/app/data
    environment:
      - NODE_ENV=production
      - DATABASE_URL=file:/app/data/stories.db
      - PORT=3001
      - CORS_ORIGIN=https://${DOMAIN:-story.example.com}
      - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY:-}
      - OPENROUTER_API_KEY=${OPENROUTER_API_KEY:-}
    networks:
      - caddy
    labels:
      caddy: ${API_DOMAIN:-api.story.example.com}
      caddy.reverse_proxy: "{{upstreams 3001}}"

  frontend:
    image: aeolun/story-frontend:latest
    restart: unless-stopped
    environment:
      - BACKEND_URL=https://${API_DOMAIN:-api.story.example.com}
    networks:
      - caddy
    depends_on:
      - backend
    labels:
      caddy: ${DOMAIN:-story.example.com}
      caddy.reverse_proxy: "{{upstreams 80}}"
      caddy.encode: gzip

networks:
  caddy:
    external: true
```

### 5. Deploy

Click **Deploy the stack**

## Verify Deployment

1. **Check Caddy logs** to ensure certificates are obtained:
   ```bash
   docker logs caddy
   ```

2. **Access your application**:
   - Frontend: `https://story.yourdomain.com`
   - Backend API: `https://api.story.yourdomain.com/api/health`

## Updating

To update to the latest version:

1. In Portainer, go to your `story` stack
2. Click **Stop** 
3. Click **Pull and redeploy**
4. Confirm the update

## Backup

The SQLite database is stored at the path specified in `DATA_PATH`. To backup:

```bash
# Create backup
cp /srv/docker/story/data/stories.db /backups/stories-$(date +%Y%m%d).db

# Or use rsync for incremental backups
rsync -av /srv/docker/story/data/ /backups/story-data/
```

## Troubleshooting

### Check container logs
```bash
# In Portainer, click on the container and view logs
# Or via CLI:
docker logs story_backend_1
docker logs story_frontend_1
```

### Database permissions
If you get database errors, ensure proper permissions:
```bash
sudo chown -R 1000:1000 /srv/docker/story/data
```

### CORS issues
Ensure `CORS_ORIGIN` in backend matches your frontend URL exactly (including https://)

### Caddy not routing
Ensure the `caddy` network exists and containers are connected:
```bash
docker network ls | grep caddy
docker inspect story_backend_1 | grep -A 5 Networks
```

## Advanced Configuration

### Using Traefik Instead of Caddy

Replace the `labels` section with Traefik labels:

```yaml
labels:
  - "traefik.enable=true"
  - "traefik.http.routers.story-backend.rule=Host(`api.story.yourdomain.com`)"
  - "traefik.http.routers.story-backend.tls.certresolver=letsencrypt"
  - "traefik.http.services.story-backend.loadbalancer.server.port=3001"
```

### Adding Basic Authentication

Add to backend labels:
```yaml
caddy.basicauth: /*
caddy.basicauth.user: $2a$14$... # Generate with: caddy hash-password
```

### Resource Limits

Add to each service:
```yaml
deploy:
  resources:
    limits:
      cpus: '1.0'
      memory: 512M
    reservations:
      cpus: '0.5'
      memory: 256M
```