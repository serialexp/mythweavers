import { z } from 'zod'

/**
 * Shared Zod schemas for story-shaped responses.
 *
 * The public-facing story shape is reused by the bookshelf endpoints (which
 * return saved stories) and any future read-side feature that surfaces stories
 * to readers. Defining it once here keeps the contract consistent across
 * endpoints.
 */

// ---------------------------------------------------------------------------
// Enums (mirroring Prisma)
// ---------------------------------------------------------------------------

export const storyStatusSchema = z.enum(['COMPLETED', 'ONGOING', 'HIATUS']).meta({
  description: 'Story publication status',
  example: 'ONGOING',
})

export const storyTypeSchema = z.enum(['FANFICTION', 'ORIGINAL']).meta({
  description: 'Story type',
  example: 'ORIGINAL',
})

export const savedTypeSchema = z.enum(['FAVORITE', 'FOLLOW', 'READ_LATER']).meta({
  description: 'Bookshelf save category',
  example: 'FAVORITE',
})

// ---------------------------------------------------------------------------
// Public story shape
// ---------------------------------------------------------------------------

export const ownerSchema = z.strictObject({
  id: z.number().meta({
    description: 'Owner user ID',
    example: 1,
  }),
  username: z.string().meta({
    description: 'Owner username',
    example: 'johndoe',
  }),
})

export const publicStorySchema = z.strictObject({
  id: z.string().meta({
    description: 'Story ID',
    example: 'clx1234567890',
  }),
  name: z.string().meta({
    description: 'Story name/title',
    example: 'My Epic Adventure',
  }),
  summary: z.string().nullable().meta({
    description: 'Story summary/description',
    example: 'A tale of heroes and dragons',
  }),
  owner: ownerSchema,
  status: storyStatusSchema,
  type: storyTypeSchema,
  coverColor: z.string().meta({
    description: 'Cover background color',
    example: '#000000',
  }),
  coverTextColor: z.string().meta({
    description: 'Cover text color',
    example: '#FFFFFF',
  }),
  coverFontFamily: z.string().meta({
    description: 'Cover font family',
    example: 'Georgia',
  }),
  coverArtUrl: z.string().nullable().meta({
    description:
      "Relative URL path to the story's uploaded cover image (null if none). Resolve against the backend origin.",
    example: '/files/1/2025/12/cover.png',
  }),
  pages: z.number().nullable().meta({
    description: 'Estimated page count',
    example: 120,
  }),
  publishedAt: z.string().meta({
    description: 'When this story became publicly visible (ISO-8601). Always set for public responses.',
    example: '2025-12-05T12:00:00.000Z',
  }),
  firstChapterReleasedAt: z.string().nullable().meta({
    description:
      "Earliest publishedAt across the story's non-deleted chapters (ISO-8601). Null if no chapters are live yet.",
    example: '2025-12-05T12:00:00.000Z',
  }),
  lastChapterReleasedAt: z.string().nullable().meta({
    description:
      "Latest publishedAt across the story's non-deleted chapters (ISO-8601). Null if no chapters are live yet.",
    example: '2026-03-01T12:00:00.000Z',
  }),
  createdAt: z.string().meta({
    description: 'Creation timestamp',
    example: '2025-12-05T12:00:00.000Z',
  }),
  updatedAt: z.string().meta({
    description: 'Last update timestamp',
    example: '2025-12-05T12:00:00.000Z',
  }),
})

/**
 * Format a Prisma `Story` row (with `owner` and optional `coverArtFile`
 * relations loaded) into the public response shape.
 *
 * Callers MUST include the relations referenced here when querying:
 *   include: { owner: true, coverArtFile: true }
 */
// biome-ignore lint/suspicious/noExplicitAny: prisma generic story shape
export function formatPublicStory(story: any) {
  return {
    id: story.id,
    name: story.name,
    summary: story.summary,
    owner: {
      id: story.owner.id,
      username: story.owner.username,
    },
    status: story.status,
    type: story.type,
    coverColor: story.coverColor,
    coverTextColor: story.coverTextColor,
    coverFontFamily: story.coverFontFamily,
    coverArtUrl: story.coverArtFile?.path ?? null,
    pages: story.pages,
    publishedAt: story.publishedAt.toISOString(),
    firstChapterReleasedAt: story.firstChapterReleasedAt
      ? story.firstChapterReleasedAt.toISOString()
      : null,
    lastChapterReleasedAt: story.lastChapterReleasedAt
      ? story.lastChapterReleasedAt.toISOString()
      : null,
    createdAt: story.createdAt.toISOString(),
    updatedAt: story.updatedAt.toISOString(),
  }
}

/**
 * Where-clause fragment matching stories that are publicly visible right now
 * (publishedAt set AND in the past). Reused by listing endpoints and
 * bookshelf to avoid surfacing unpublished/scheduled stories.
 */
export function storyVisibleWhere(now: Date) {
  return { publishedAt: { not: null, lte: now } } as const
}
