/**
 * Lightweight structural reads: the story outline and story-wide search.
 *
 * Both exist because `load-story` is the only bulk read the API had, and it
 * returns every paragraph body in the story — right for hydrating the editor
 * once, far too heavy for "what chapters are there" or "where did I mention
 * the amulet".
 */

import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { requireAuth } from '../../lib/auth.js'
import { errorSchema } from '../../schemas/common.js'
import { flattenOutline, getOutline, searchStory } from '../../services/story/index.js'

const nodeKindSchema = z.enum(['book', 'arc', 'chapter', 'scene']).meta({
  description: 'Story tree level',
  example: 'chapter',
})

const outlineNodeSchema = z.strictObject({
  kind: nodeKindSchema,
  id: z.string().meta({ description: 'Node ID', example: 'clx1234567890' }),
  name: z.string().meta({ description: 'Node name', example: 'The Crossing' }),
  parentId: z.string().nullable().meta({ description: 'Parent node ID (null at the requested root)' }),
  depth: z.number().int().meta({ description: 'Depth below the requested root, starting at 0', example: 0 }),
  sortOrder: z.number().int().meta({ description: 'Position among siblings', example: 0 }),
  status: z.string().nullable().optional().meta({ description: 'draft | needs_work | review | done' }),
  wordCount: z.number().int().optional().meta({
    description: 'Cached word count. Chapters store one; books and arcs sum their chapters. Absent on scenes.',
    example: 3412,
  }),
  publishedAt: z.string().nullable().optional().meta({ description: 'Publication timestamp (chapters only)' }),
  summary: z.string().nullable().optional(),
  sentenceSummary: z.string().nullable().optional(),
  paragraphSummary: z.string().nullable().optional(),
  perspective: z.string().nullable().optional().meta({ description: 'FIRST | SECOND | THIRD (scenes only)' }),
  viewpointCharacterId: z.string().nullable().optional(),
  goal: z.string().nullable().optional(),
  includeInFull: z.number().int().optional().meta({
    description: '0 = excluded from context, 1 = summary only, 2 = full content',
  }),
})

const outlineResponseSchema = z.strictObject({
  storyId: z.string(),
  storyName: z.string(),
  root: z.strictObject({
    kind: z.enum(['story', 'book', 'arc', 'chapter', 'scene']),
    id: z.string(),
    name: z.string(),
  }),
  depth: nodeKindSchema,
  totalWords: z.number().int().meta({ description: 'Sum of cached chapter word counts in scope', example: 148000 }),
  counts: z.strictObject({
    book: z.number().int(),
    arc: z.number().int(),
    chapter: z.number().int(),
    scene: z.number().int(),
  }),
  nodes: z.array(outlineNodeSchema).meta({
    description: 'Depth-first flattening of the tree. Rebuild the hierarchy from parentId if you need it nested.',
  }),
})

const outlineQuerySchema = z.strictObject({
  rootId: z.string().optional().meta({
    description: 'Limit the outline to the subtree under this node',
    example: 'clx1234567890',
  }),
  depth: nodeKindSchema.optional().meta({
    description: 'Deepest level to include. Defaults to chapter — scenes are opt-in because they multiply the size.',
    example: 'chapter',
  }),
  includeSummaries: z.coerce.boolean().optional().meta({
    description: 'Include summary / sentenceSummary / paragraphSummary on every node',
  }),
  includeSceneDetail: z.coerce.boolean().optional().meta({
    description: 'Include POV, goal and context-inclusion flags on scenes',
  }),
})

const searchQuerySchema = z.strictObject({
  q: z.string().min(2).meta({ description: 'Case-insensitive substring to look for', example: 'amulet' }),
  scope: z.enum(['prose', 'characters', 'context', 'summaries', 'all']).optional().meta({
    description: 'Which parts of the story to search. Defaults to all.',
    example: 'prose',
  }),
  limit: z.coerce.number().int().min(1).max(200).optional().meta({
    description: 'Maximum hits per scope (default 40)',
    example: 40,
  }),
})

const searchHitSchema = z.object({
  kind: z.enum(['prose', 'character', 'contextItem', 'summary']),
  snippet: z.string().meta({ description: 'Matching text with a little surrounding context' }),
  id: z.string().optional(),
  name: z.string().optional(),
  field: z.string().optional(),
  type: z.string().optional(),
  nodeKind: z.string().optional(),
  paragraphId: z.string().optional(),
  messageId: z.string().optional(),
  sceneId: z.string().optional(),
  sceneName: z.string().optional(),
  chapterId: z.string().optional(),
  chapterName: z.string().optional(),
})

const searchResponseSchema = z.strictObject({
  storyId: z.string(),
  query: z.string(),
  scope: z.enum(['prose', 'characters', 'context', 'summaries', 'all']),
  truncated: z.boolean().meta({ description: 'True when a scope hit the limit and results were cut off' }),
  hits: z.array(searchHitSchema),
})

const storyIdParamSchema = z.strictObject({
  storyId: z.string().meta({ description: 'Story ID', example: 'clx1234567890' }),
})

const outlineRoutes: FastifyPluginAsyncZod = async (fastify) => {
  fastify.get(
    '/stories/:storyId/outline',
    {
      preHandler: requireAuth,
      schema: {
        description:
          'Structural outline of a story, without prose. Four flat queries regardless of story size — use this ' +
          'to navigate before reading content.',
        tags: ['outline'],
        params: storyIdParamSchema,
        querystring: outlineQuerySchema,
        response: {
          200: outlineResponseSchema,
          400: errorSchema,
          401: errorSchema,
          404: errorSchema,
        },
      },
    },
    async (request) => {
      const outline = await getOutline(request.user!.id, request.params.storyId, {
        rootId: request.query.rootId,
        depth: request.query.depth,
        includeSummaries: request.query.includeSummaries,
        includeSceneDetail: request.query.includeSceneDetail,
      })
      return { ...outline, nodes: flattenOutline(outline.nodes) }
    },
  )

  fastify.get(
    '/stories/:storyId/search',
    {
      preHandler: requireAuth,
      schema: {
        description:
          'Case-insensitive substring search across prose, characters, context items and node summaries. ' +
          'Only current paragraph revisions are searched.',
        tags: ['outline'],
        params: storyIdParamSchema,
        querystring: searchQuerySchema,
        response: {
          200: searchResponseSchema,
          400: errorSchema,
          401: errorSchema,
          404: errorSchema,
        },
      },
    },
    async (request) => {
      return await searchStory(request.user!.id, request.params.storyId, request.query.q, {
        scope: request.query.scope,
        limit: request.query.limit,
      })
    },
  )
}

export default outlineRoutes
