import { z } from 'zod'

/**
 * Common/shared Zod schemas used across multiple endpoints
 *
 * These schemas are reusable components that appear in multiple API responses.
 * Define them once here and import where needed.
 */

// User schema - appears in auth responses and other user-related endpoints
export const userSchema = z.strictObject({
  id: z.number().meta({
    description: 'User ID',
    example: 1,
  }),
  email: z.string().email().meta({
    description: 'User email address',
    example: 'user@example.com',
  }),
  username: z.string().meta({
    description: 'Username',
    example: 'johndoe',
  }),
})

// Standard error response - using z.object (not strict) to allow extra debug fields in dev
export const errorSchema = z.object({
  error: z.string().meta({
    description: 'Error message',
    example: 'Invalid credentials',
  }),
  // Optional fields that may be included in development mode
  validation: z.any().optional(),
  zodIssues: z.any().optional(),
  stack: z.string().optional(),
  debug: z.any().optional(),
})

// Success response with boolean flag
export const successSchema = z.strictObject({
  success: z.literal(true).meta({
    description: 'Operation succeeded',
  }),
})

// Pagination metadata (for list endpoints)
export const paginationSchema = z.strictObject({
  page: z.number().int().positive().meta({
    description: 'Current page number',
    example: 1,
  }),
  pageSize: z.number().int().positive().meta({
    description: 'Items per page',
    example: 20,
  }),
  total: z.number().int().nonnegative().meta({
    description: 'Total number of items',
    example: 100,
  }),
  totalPages: z.number().int().nonnegative().meta({
    description: 'Total number of pages',
    example: 5,
  }),
})
