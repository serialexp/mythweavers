# Story Application

A creative writing assistant with AI-powered story generation and management.

## Features

- **AI Story Generation**: Interactive story writing with Ollama integration
- **Character Management**: Create and manage story characters
- **Context Items**: Track themes, locations, and custom story elements
- **Story Persistence**: Save stories locally with optional server sync
- **Cross-Device Sync**: Access your stories from multiple devices

## Setup

### Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- Ollama running locally (for AI generation)

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd story
```

2. Install all dependencies (frontend and backend):
```bash
npm run install:all
```

## Running the Application

### Development Mode (Frontend + Backend)

Run both frontend and backend servers concurrently:

```bash
npm run dev
```

This will start:
- Frontend: http://localhost:5173
- Backend API: http://localhost:3001

### Running Separately

If you prefer to run frontend and backend separately:

```bash
# Frontend only
npm run dev:frontend

# Backend only (in another terminal)
npm run dev:backend
```

### Frontend Only (No Server Sync)

The application works perfectly fine without the backend server. Just run:

```bash
npm run dev:frontend
```

Stories will be saved to browser localStorage only.

## Server Sync Features

When the backend server is running, you'll see additional features:

- **Server Status Indicator**: Shows when connected to the backend
- **Sync Buttons**: Upload local stories to server or download server stories
- **Tabbed Interface**: Switch between local and server stories
- **Cross-Device Access**: Stories synced to server can be accessed from any device

## Building for Production

```bash
# Build frontend
npm run build

# Build backend
npm run build:backend
```

## Database Management

The backend uses SQLite with Prisma ORM. Useful commands:

```bash
# View/edit database
cd backend && npm run prisma:studio

# Create new migration
cd backend && npm run prisma:migrate

# Regenerate Prisma client
cd backend && npm run prisma:generate
```

## Configuration

### Frontend Settings
- Ollama host and model selection in the app settings
- Story generation parameters (person, tense, paragraphs per turn)
- Smart context and auto-generation options

### Backend Configuration
- Port: Set in `backend/.env` (default: 3001)
- Database: SQLite file at `backend/prisma/stories.db`
- Server listens on 0.0.0.0 (accessible from any network interface)

### Frontend Configuration
- API URL: Automatically uses the same hostname as the frontend with port 3001
- Override with `VITE_API_URL` environment variable if needed
- Example: `VITE_API_URL=http://192.168.1.100:3001/api npm run dev:frontend`

## Technology Stack

### Frontend
- SolidJS - Reactive UI framework
- Vite - Build tool and dev server
- TypeScript - Type safety
- Ollama - Local AI integration

### Backend
- Express - Web server framework
- Prisma - Database ORM
- SQLite - Embedded database
- TypeScript - Type safety

## Troubleshooting

### Ollama Connection Issues
- Ensure Ollama is running locally
- Check the Ollama host setting in the app
- Verify Ollama is accessible at the configured URL

### Server Sync Not Working
- Check if backend server is running
- Verify backend is accessible at http://localhost:3001
- Check browser console for connection errors

### Database Issues
- Run `cd backend && npm run prisma:migrate` to ensure schema is up to date
- Use `npm run prisma:studio` to inspect database contents