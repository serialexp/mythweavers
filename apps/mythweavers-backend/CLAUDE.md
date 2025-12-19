# Unified Backend API Guide

This guide explains how to properly define REST API endpoints with full type safety and OpenAPI documentation.

## Tech Stack

- **Runtime**: Bun
- **Framework**: Fastify
- **Validation**: Zod v4
- **OpenAPI**: fastify-zod-openapi
- **Database**: Prisma + PostgreSQL
- **Auth**: Session-based with httpOnly cookies

## Architecture

```
src/
├── routes/           # API route handlers organized by resource
│   ├── auth/
│   └── stories/
├── schemas/          # Shared Zod schemas
│   └── common.ts     # Reusable schemas (user, error, pagination, etc.)
├── lib/              # Utilities (prisma, config, etc.)
└── index.ts          # Main server setup
```

## Prisma Migrations

**IMPORTANT: Interactive Sessions Required**

When Prisma complains about "non-interactive environment", it usually means:
- The migration would cause **data loss** (dropping columns/tables)
- The migration has **ambiguous changes** (renaming vs deleting+creating)
- Prisma needs **user confirmation** before proceeding

**If you see this error:**
```
Error: Prisma Migrate has detected that the environment is non-interactive
```

**Solution:** Tell Bart to run the migration interactively in his terminal:
```bash
cd apps/unified-backend
pnpm prisma migrate dev --name describe_the_change
```

This allows Bart to review changes, confirm data loss, or provide guidance on ambiguous operations.

**Common scenarios requiring interaction:**
- Renaming columns (Prisma can't tell rename vs delete+create)
- Dropping columns with data
- Changing column types incompatibly
- Adding non-nullable columns without defaults

## Defining API Endpoints

Every REST endpoint MUST have:
1. **Input validation** (request body, query params, path params)
2. **Output validation** (response schemas for all status codes)
3. **OpenAPI metadata** (descriptions, examples, tags)

### CRITICAL: Route Registration

**When creating a new route file, you MUST register it in TWO places:**

1. **`src/index.ts`** - Main server (for production/dev)
   ```typescript
   import myNewRoutes from './routes/my/new-routes.js'
   // ...
   await server.register(myNewRoutes, { prefix: '/my' })
   ```

2. **`tests/helpers.ts`** - Test helper (for tests)
   ```typescript
   import myNewRoutes from '../src/routes/my/new-routes.js'
   // ...
   await app.register(myNewRoutes, { prefix: '/my' })
   ```

**Forgetting to add routes to `tests/helpers.ts` will cause all tests to fail with 404 errors!**

### Pattern: Complete Endpoint Definition

```typescript
import { z } from 'zod'
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { userSchema, errorSchema } from '../../schemas/common.js'

// 1. Define request schemas with OpenAPI metadata
const createStoryBodySchema = z.object({
  name: z.string().min(1).max(200).meta({
    description: 'Story title',
    example: 'My Epic Adventure',
  }),
  summary: z.string().optional().meta({
    description: 'Story summary/description',
    example: 'A tale of heroes and dragons',
  }),
})

// 2. Define response schemas
const storySchema = z.object({
  id: z.string().meta({ example: 'clx1234567890' }),
  name: z.string().meta({ example: 'My Epic Adventure' }),
  summary: z.string().nullable(),
  ownerId: z.number(),
  createdAt: z.string().meta({ example: '2025-12-05T12:00:00.000Z' }),
})

const createStoryResponseSchema = z.object({
  success: z.literal(true),
  story: storySchema,
})

// 3. Define the route with complete schema
const storyRoutes: FastifyPluginAsyncZod = async (fastify) => {
  fastify.post(
    '/stories',
    {
      schema: {
        description: 'Create a new story',
        tags: ['stories'],
        body: createStoryBodySchema,
        response: {
          201: createStoryResponseSchema,
          400: errorSchema,  // From common schemas
          401: errorSchema,
        },
      },
    },
    async (request, reply) => {
      // Handler implementation
      // request.body is fully typed from createStoryBodySchema
      // reply must match one of the response schemas
    }
  )
}
```

## Zod v4 with OpenAPI Metadata

We use Zod v4's `.meta()` method to add OpenAPI-specific metadata:

```typescript
// Basic field with metadata
z.string().meta({
  description: 'Human-readable description',
  example: 'example value',
})

// Field with validation and metadata
z.string()
  .min(3)
  .max(50)
  .meta({
    description: 'Username (3-50 characters)',
    example: 'johndoe',
  })

// Optional field
z.string().optional().meta({
  description: 'Optional field description',
  example: 'example',
})

// Enum field
z.enum(['ONGOING', 'COMPLETED', 'HIATUS']).meta({
  description: 'Story status',
  example: 'ONGOING',
})
```

## Reusable Schemas

**Always use shared schemas from `src/schemas/common.ts` for:**
- User objects (`userSchema`)
- Error responses (`errorSchema`)
- Success responses (`successSchema`)
- Pagination metadata (`paginationSchema`)

```typescript
import { userSchema, errorSchema, paginationSchema } from '../../schemas/common.js'

// Compose schemas
const listStoriesResponseSchema = z.object({
  stories: z.array(storySchema),
  pagination: paginationSchema,
})
```

## Request Schemas

### Body Parameters (POST/PUT/PATCH)

```typescript
const bodySchema = z.object({
  field1: z.string(),
  field2: z.number().optional(),
})

fastify.post('/endpoint', {
  schema: {
    body: bodySchema,
    response: { 200: responseSchema },
  },
}, handler)
```

### Query Parameters (GET)

```typescript
const querySchema = z.object({
  page: z.coerce.number().int().positive().default(1).meta({
    description: 'Page number',
    example: 1,
  }),
  search: z.string().optional().meta({
    description: 'Search query',
    example: 'dragon',
  }),
})

fastify.get('/stories', {
  schema: {
    querystring: querySchema,
    response: { 200: responseSchema },
  },
}, handler)
```

### Path Parameters

```typescript
const paramsSchema = z.object({
  id: z.string().meta({
    description: 'Story ID',
    example: 'clx1234567890',
  }),
})

fastify.get('/stories/:id', {
  schema: {
    params: paramsSchema,
    response: { 200: responseSchema, 404: errorSchema },
  },
}, handler)
```

## Response Schemas

**CRITICAL**: Define response schemas for ALL possible status codes:

```typescript
schema: {
  response: {
    200: successResponseSchema,  // Success
    400: errorSchema,            // Bad request / validation error
    401: errorSchema,            // Unauthorized
    403: errorSchema,            // Forbidden
    404: errorSchema,            // Not found
    409: errorSchema,            // Conflict (duplicate, etc.)
    500: errorSchema,            // Server error
  },
}
```

## Common Response Patterns

### Success with data
```typescript
z.object({
  success: z.literal(true),
  data: dataSchema,
})
```

### List with pagination
```typescript
z.object({
  items: z.array(itemSchema),
  pagination: paginationSchema,
})
```

### Boolean status
```typescript
z.object({
  authenticated: z.boolean(),
  user: userSchema.optional(),
})
```

## Type Safety

TypeScript will infer types from your Zod schemas:

```typescript
// In the handler
async (request, reply) => {
  // request.body is typed as z.infer<typeof bodySchema>
  const { name, summary } = request.body

  // Must return a type matching one of the response schemas
  return {
    success: true as const,  // Use 'as const' for literal types
    story: { /* ... */ },
  }
}
```

## Testing

Tests should verify both success and error cases for all endpoints:

```typescript
test('should create story successfully', async () => {
  const response = await app.inject({
    method: 'POST',
    url: '/stories',
    payload: {
      name: 'Test Story',
      summary: 'Test summary',
    },
  })

  expect(response.statusCode).toBe(201)
  const body = response.json()
  expect(body.success).toBe(true)
  expect(body.story.name).toBe('Test Story')
})

test('should return 400 for invalid input', async () => {
  const response = await app.inject({
    method: 'POST',
    url: '/stories',
    payload: {
      name: '',  // Invalid: empty string
    },
  })

  expect(response.statusCode).toBe(400)
  const body = response.json()
  expect(body.error).toBeDefined()
})
```

## Server Setup (Already Configured)

The main server (`src/index.ts`) is configured with:

```typescript
// Set Zod compilers
server.setValidatorCompiler(validatorCompiler)
server.setSerializerCompiler(serializerCompiler)

// Register fastify-zod-openapi
await server.register(fastifyZodOpenApiPlugin)

// Register Swagger with transformers
await server.register(swagger, {
  openapi: { /* ... */ },
  ...fastifyZodOpenApiTransformers,  // Converts Zod to OpenAPI
})
```

## OpenAPI Documentation

Once properly configured, your API documentation will automatically include:
- Request/response schemas
- Validation rules
- Examples
- Descriptions

Access at: **http://localhost:3201/docs**

## Testing Requirements

**CRITICAL: Every endpoint MUST have comprehensive tests.**

### Test Coverage Requirements

For each endpoint, you MUST test:

1. **Success case** - Verify the happy path works
2. **Validation errors** - Test with invalid/missing input
3. **Auth errors** - Test without auth when required
4. **Not found** - Test with non-existent resources
5. **Conflict errors** - Test duplicate creation, etc.
6. **Edge cases** - Empty strings, boundary values, etc.

### Why Tests Are Required

- **Catches regressions** - Ensures changes don't break existing functionality
- **Validates schemas** - Confirms Zod validation actually works
- **Documents behavior** - Tests show how the API should be used
- **Type safety** - Verifies TypeScript types match runtime behavior
- **Prevents shipping bugs** - NO ENDPOINT WITHOUT TESTS

### Test Pattern

```typescript
describe('POST /stories', () => {
  test('should create story successfully', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/stories',
      payload: { name: 'Test Story', summary: 'Test' },
      cookies: { sessionToken: validToken },
    })

    expect(response.statusCode).toBe(201)
    const body = response.json()
    expect(body.success).toBe(true)
    expect(body.story.name).toBe('Test Story')
  })

  test('should return 400 for empty name', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/stories',
      payload: { name: '' },
    })

    expect(response.statusCode).toBe(400)
    expect(response.json().error).toBeDefined()
  })

  test('should return 401 without authentication', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/stories',
      payload: { name: 'Test' },
    })

    expect(response.statusCode).toBe(401)
  })
})
```

### Running Tests

```bash
# Run all tests
pnpm --filter @writer/unified-backend test

# Watch mode (automatically re-run on changes)
pnpm --filter @writer/unified-backend test:watch
```

### Test Location

Tests live in `/tests/` directory, organized by feature:
- `tests/auth.test.ts` - Auth endpoint tests
- `tests/stories.test.ts` - Story endpoint tests
- `tests/helpers.ts` - Test utilities (buildApp, cleanDatabase, etc.)

## Checklist for New Endpoints

- [ ] Define input schema with `.meta()` for all fields
- [ ] Define output schemas for ALL status codes (200, 400, 401, 404, etc.)
- [ ] Use shared schemas from `src/schemas/common.ts` where applicable
- [ ] Add proper TypeScript types (`as const` for literals)
- [ ] **Write tests for success AND all error cases** ⚠️ REQUIRED
- [ ] Verify OpenAPI docs are generated correctly
- [ ] Check that validation actually works (test with invalid data)
- [ ] Run `pnpm test` and ensure all tests pass

## Examples

See `src/routes/auth/index.ts` for complete examples of:
- POST /auth/register
- POST /auth/login
- POST /auth/logout
- GET /auth/session

These demonstrate the full pattern with validation, error handling, and OpenAPI metadata.
