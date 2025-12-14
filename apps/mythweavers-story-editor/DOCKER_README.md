# Docker Deployment Guide

This guide explains how to build and run the Story application using Docker.

## Prerequisites

- Docker installed on your system
- Docker Compose installed
- At least 2GB of free disk space

## Quick Start (Using Pre-built Images)

1. **Create data directory** (for SQLite database persistence):
   ```bash
   mkdir -p ./data
   ```

2. **Download the production docker-compose file**:
   ```bash
   wget https://raw.githubusercontent.com/your-repo/story/main/docker-compose.prod.yml
   ```

3. **Configure environment** (optional):
   Edit `docker-compose.prod.yml` to set:
   - `BACKEND_URL` - The URL where your backend will be accessible
   - `CORS_ORIGIN` - Allowed frontend origins for CORS

4. **Start the containers**:
   ```bash
   docker-compose -f docker-compose.prod.yml up -d
   ```

5. **Access the application**:
   - Frontend: http://localhost
   - Backend API: http://localhost:3001

## Building from Source

1. **Clone the repository and build**:
   ```bash
   npm run docker:build
   # Or build individually:
   npm run docker:build:backend
   npm run docker:build:frontend
   ```

2. **Start with local build**:
   ```bash
   npm run docker:up
   ```

## Docker Commands

The following npm scripts are available for Docker management:

- `npm run docker:build` - Build both Docker images
- `npm run docker:build:backend` - Build backend image only
- `npm run docker:build:frontend` - Build frontend image only
- `npm run docker:push` - Push both images to Docker Hub
- `npm run docker:push:backend` - Push backend image to Docker Hub
- `npm run docker:push:frontend` - Push frontend image to Docker Hub
- `npm run docker:build-push` - Build and push both images
- `npm run docker:up` - Start containers in detached mode
- `npm run docker:down` - Stop and remove containers
- `npm run docker:logs` - View container logs
- `npm run docker:rebuild` - Rebuild images from scratch and restart

## Database Persistence

The SQLite database is stored in the `./data` directory on your host machine. This ensures your stories persist across container restarts.

- Database location in container: `/app/data/stories.db`
- Database location on host: `./data/stories.db`

## Environment Variables

### Backend Environment Variables
- `NODE_ENV` - Set to `production` for production deployments
- `DATABASE_URL` - SQLite database path (default: `file:/app/data/stories.db`)
- `PORT` - Backend server port (default: `3001`)
- `CORS_ORIGIN` - Allowed origins for CORS (default: `*` allows all, set to frontend URL for production)
- `ANTHROPIC_API_KEY` - Optional: Anthropic API key
- `OPENROUTER_API_KEY` - Optional: OpenRouter API key

### Frontend Environment Variables
- `BACKEND_URL` - Backend API URL (default: `http://localhost:3001`)
  - Can be set at runtime without rebuilding the image
  - Example: `docker run -e BACKEND_URL=https://api.yourdomain.com aeolun/story-frontend`

For production deployment, you can set environment variables in several ways:

1. **Using docker-compose.yml** (already configured for basic setup)
2. **Using .env file**:
   ```bash
   cp .env.docker.example .env
   # Edit .env with your values
   ```
3. **Using docker-compose override**:
   Create a `docker-compose.override.yml` file for local overrides

## Production Deployment

For production deployment:

1. **Update ports** in `docker-compose.yml` if needed
2. **Set up a reverse proxy** (nginx, traefik, etc.) for HTTPS
3. **Configure environment variables** for your API keys
4. **Set up automated backups** for the `./data` directory

## Troubleshooting

### Container won't start
```bash
# Check logs
docker-compose logs backend
docker-compose logs frontend

# Rebuild from scratch
npm run docker:rebuild
```

### Database issues
```bash
# Ensure data directory exists and has correct permissions
mkdir -p ./data
chmod 755 ./data
```

### Port conflicts
If ports 80 or 3001 are already in use, modify the port mappings in `docker-compose.yml`:
```yaml
ports:
  - "8080:80"  # Change 8080 to your desired port
```

## Architecture

The Docker setup consists of:

1. **Backend Container**:
   - Node.js Alpine image
   - Runs on port 3001
   - Mounts SQLite database from host
   - Handles API and WebSocket connections

2. **Frontend Container**:
   - Nginx Alpine image
   - Serves static Vite build
   - Proxies API/WebSocket requests to backend
   - Runs on port 80

3. **Network**:
   - Both containers share a bridge network for internal communication
   - Frontend proxies `/api` and `/ws` routes to backend

## Backup and Restore

### Backup
```bash
# Backup the database
cp ./data/stories.db ./data/stories.db.backup

# Or create timestamped backup
cp ./data/stories.db "./data/stories.db.backup.$(date +%Y%m%d_%H%M%S)"
```

### Restore
```bash
# Stop containers first
docker-compose down

# Restore database
cp ./data/stories.db.backup ./data/stories.db

# Start containers
docker-compose up -d
```

## Development vs Production

The Docker setup is configured for production use:
- Frontend serves optimized static files via nginx
- Backend runs in production mode
- Proper health checks configured
- Automatic restart on failure

For development, continue using:
```bash
npm run dev
```