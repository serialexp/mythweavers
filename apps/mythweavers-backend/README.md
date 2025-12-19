# Unified Backend

Unified backend for Writer2 and Story projects, combining all features into a single PostgreSQL + Prisma + Fastify API.

## Tech Stack

- **Database:** PostgreSQL with Prisma ORM
- **Server:** Fastify with OpenAPI documentation
- **Type Safety:** TypeScript + Zod validation
- **API Style:** RESTful with OpenAPI/Swagger UI

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL 14+
- pnpm

### Setup

1. Install dependencies:
```bash
pnpm install
```

2. Configure environment:
```bash
cp .env.example .env
# Edit .env with your PostgreSQL connection string
```

3. Generate Prisma client:
```bash
pnpm prisma:generate
```

4. Run migrations:
```bash
pnpm prisma:migrate
```

5. Start development server:
```bash
pnpm dev
```

Server will be available at `http://localhost:3001`

API documentation at `http://localhost:3001/docs`

## Scripts

- `pnpm dev` - Start development server with hot reload
- `pnpm build` - Build for production
- `pnpm start` - Start production server
- `pnpm prisma:generate` - Generate Prisma client
- `pnpm prisma:migrate` - Run database migrations
- `pnpm prisma:studio` - Open Prisma Studio (database GUI)
- `pnpm migrate:writer2` - Migrate data from Writer2 MySQL
- `pnpm migrate:story` - Migrate data from Story SQLite

## Project Structure

```
unified-backend/
├── src/
│   ├── index.ts              # Main server entry point
│   ├── routes/               # API route handlers
│   │   ├── auth/             # Authentication endpoints
│   │   ├── stories/          # Story CRUD operations
│   │   ├── characters/       # Character management
│   │   ├── messages/         # Message/paragraph operations
│   │   ├── maps/             # Map system endpoints
│   │   └── calendars/        # Calendar management
│   └── migrations/           # Data migration scripts
│       ├── migrate-writer2.ts
│       └── migrate-story.ts
├── prisma/
│   └── schema.prisma         # Unified database schema
└── package.json
```

## Environment Variables

```env
# Server
PORT=3001
HOST=0.0.0.0
LOG_LEVEL=info
API_URL=http://localhost:3001

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/writer_unified

# CORS
CORS_ORIGIN=*

# Migration Sources
WRITER2_DATABASE_URL=mysql://user:password@localhost:3306/writer2
STORY_DATABASE_URL=file:../story-backend/prisma/stories.db
```

## Migration Strategy

### From Writer2 (MySQL)

```bash
# Set WRITER2_DATABASE_URL in .env
pnpm migrate:writer2
```

Migrates:
- Users, Stories, Books, Arcs, Chapters, Scenes
- Paragraphs with revision history
- Characters (→ Character table)
- Locations (→ ContextItem type='location')
- PlotPoints (→ ContextItem type='plot')
- Files, Tags

### From Story (SQLite)

```bash
# Set STORY_DATABASE_URL in .env
pnpm migrate:story
```

Migrates:
- Users, Stories, Node hierarchy
- Messages → Scenes with Paragraphs
- Characters with timeline support
- ContextItems (themes, locations, plots)
- Calendars, Maps, Landmarks, Fleets
- Embeddings for semantic search

## API Endpoints

Full API documentation available at `/docs` when server is running.

### Core Resources

- `GET /health` - Health check
- `POST /auth/register` - User registration
- `POST /auth/login` - User login
- `GET /stories` - List stories
- `POST /stories` - Create story
- `GET /stories/:id` - Get story details
- `PUT /stories/:id` - Update story
- `DELETE /stories/:id` - Delete story

### Story Structure

- `/stories/:id/books` - Book management
- `/stories/:id/arcs` - Arc management
- `/stories/:id/chapters` - Chapter management
- `/stories/:id/scenes` - Scene management
- `/stories/:id/paragraphs` - Paragraph operations

### Story Elements

- `/stories/:id/characters` - Character CRUD
- `/stories/:id/context-items` - Context items (locations, plots, themes)
- `/stories/:id/calendars` - Calendar configurations
- `/stories/:id/maps` - Map management
- `/stories/:id/landmarks` - Landmark CRUD
- `/stories/:id/fleets` - Fleet tracking

## Development

### Adding New Routes

1. Create route file in `src/routes/`:
```typescript
import type { FastifyPluginAsync } from 'fastify'

export const myRoutes: FastifyPluginAsync = async (server) => {
  server.get('/my-endpoint', {
    schema: {
      description: 'My endpoint description',
      tags: ['my-tag'],
      response: {
        200: {
          type: 'object',
          properties: {
            message: { type: 'string' }
          }
        }
      }
    }
  }, async (request, reply) => {
    return { message: 'Hello' }
  })
}
```

2. Register in `src/index.ts`:
```typescript
import { myRoutes } from './routes/my-routes.js'
await server.register(myRoutes, { prefix: '/my-prefix' })
```

### Schema Validation

Use Zod for request/response validation (can be integrated with fastify-zod-openapi for better DX).

## Next Steps

- [ ] Complete unified Prisma schema
- [ ] Implement authentication routes
- [ ] Port Writer2 story endpoints
- [ ] Port Story project endpoints
- [ ] Write migration scripts
- [ ] Add tests
- [ ] Set up CI/CD
