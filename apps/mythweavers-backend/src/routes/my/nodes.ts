/**
 * Unified node endpoints.
 *
 * The per-kind routes (/my/books, /my/arcs, /my/chapters, /my/scenes) remain
 * the right thing for a caller that knows exactly what it's creating. These
 * exist for callers that don't want to care: the kind is derived from the
 * parent on create and from the node itself on update, and a field that
 * doesn't apply to the derived kind comes back as a named 400 rather than
 * being silently dropped.
 */

import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { requireAuth } from '../../lib/auth.js'
import { errorSchema } from '../../schemas/common.js'
import { createNode, moveNode, readContent, updateNode } from '../../services/story/index.js'

const positionSchema = z.union([z.literal('start'), z.literal('end'), z.number().int().min(0)]).meta({
  description: '"start", "end", or a 0-based index among siblings. Siblings are renumbered to stay contiguous.',
  example: 'end',
})

/**
 * Node bodies are intentionally NOT strictObject: which fields are legal
 * depends on the kind, which isn't known until the parent is resolved. The
 * service validates the field set and reports unknown fields by name — a
 * schema-level rejection here would produce a much less useful message.
 */
const createNodeBodySchema = z
  .object({
    parentId: z.string().meta({
      description: 'Story, book, arc or chapter. The new node is whatever that parent contains.',
      example: 'clx1234567890',
    }),
    name: z.string().min(1).max(200).meta({ description: 'Node name', example: 'The Crossing' }),
    id: z.string().max(128).optional().meta({ description: 'Optional client-supplied cuid2' }),
    position: positionSchema.optional(),
  })
  .passthrough()

const updateNodeBodySchema = z
  .object({
    position: positionSchema.optional(),
    deleted: z.boolean().optional().meta({
      description: 'Soft-delete (or restore) the node. deletedAt is maintained automatically.',
    }),
  })
  .passthrough()

const moveNodeBodySchema = z.strictObject({
  parentId: z.string().optional().meta({
    description: 'New parent. Must contain the same kind of node, and be in the same story.',
  }),
  position: positionSchema.optional(),
})

const nodeResultSchema = z.strictObject({
  kind: z.enum(['book', 'arc', 'chapter', 'scene']),
  id: z.string(),
  name: z.string(),
  parentId: z.string(),
  sortOrder: z.number().int(),
  storyId: z.string(),
})

const nodeIdParamSchema = z.strictObject({
  id: z.string().meta({ description: 'Node ID', example: 'clx1234567890' }),
})

const contentQuerySchema = z.strictObject({
  maxWords: z.coerce.number().int().min(1).optional().meta({
    description: 'Refuse the read rather than return more than this many words (default 6000).',
    example: 6000,
  }),
  includeAllMessages: z.coerce.boolean().optional().meta({
    description:
      'Include normal generation messages as well as structural messages. Required when hydrating an editor scene.',
    example: true,
  }),
})

const contentParagraphSchema = z.strictObject({
  id: z.string().meta({ description: 'Paragraph ID — use this to edit it' }),
  messageRevisionId: z.string(),
  sortOrder: z.number().int(),
  currentParagraphRevisionId: z.string().nullable(),
  body: z.string().meta({
    description: 'Paragraph text as stored. Mostly plain text; may contain inline HTML such as <em> or <strong>.',
  }),
  contentSchema: z.string().nullable(),
  state: z.string().nullable(),
  plotPointActions: z.array(z.any()),
  inventoryActions: z.array(z.any()),
  words: z.number().int(),
})

const contentMessageSchema = z.strictObject({
  id: z.string(),
  sortOrder: z.number().int(),
  instruction: z.string().nullable(),
  script: z.string().nullable(),
  currentMessageRevisionId: z.string().nullable(),
  createdAt: z.string().datetime(),
  type: z.string().nullable().meta({
    description: 'null for normal prose; branch / event / background / audio for structural messages',
  }),
  isQuery: z.boolean(),
  options: z.any().nullable(),
  backgroundFileId: z.string().nullable(),
  backgroundFile: z.strictObject({ id: z.string(), path: z.string() }).nullable(),
  audioFileId: z.string().nullable(),
  audioFile: z.strictObject({ id: z.string(), path: z.string() }).nullable(),
  revision: z
    .strictObject({
      id: z.string(),
      model: z.string().nullable(),
      tokensPerSecond: z.number().nullable(),
      totalTokens: z.number().nullable(),
      promptTokens: z.number().nullable(),
      cacheCreationTokens: z.number().nullable(),
      cacheReadTokens: z.number().nullable(),
      think: z.string().nullable(),
      showThink: z.boolean(),
    })
    .nullable(),
  paragraphs: z.array(contentParagraphSchema),
})

const contentSceneSchema = z.strictObject({
  id: z.string(),
  name: z.string(),
  status: z.string().nullable(),
  perspective: z.string().nullable(),
  viewpointCharacterId: z.string().nullable(),
  viewpointCharacterName: z.string().nullable(),
  goal: z.string().nullable(),
  includeInFull: z.number().int(),
  words: z.number().int(),
  messages: z.array(contentMessageSchema),
})

const contentResponseSchema = z.strictObject({
  storyId: z.string(),
  root: z.strictObject({ kind: z.string(), id: z.string(), name: z.string() }),
  words: z.number().int(),
  chapters: z.array(
    z.strictObject({
      id: z.string(),
      name: z.string(),
      status: z.string().nullable(),
      words: z.number().int(),
      scenes: z.array(contentSceneSchema),
    }),
  ),
})

const nodesRoutes: FastifyPluginAsyncZod = async (fastify) => {
  fastify.post(
    '/nodes',
    {
      preHandler: requireAuth,
      schema: {
        description:
          'Create a book, arc, chapter or scene. The kind is derived from the parent: story→book, book→arc, ' +
          'arc→chapter, chapter→scene. Fields that do not apply to the derived kind are rejected by name.',
        tags: ['nodes'],
        body: createNodeBodySchema,
        response: {
          201: z.strictObject({ success: z.literal(true), node: nodeResultSchema }),
          400: errorSchema,
          401: errorSchema,
          404: errorSchema,
        },
      },
    },
    async (request, reply) => {
      const node = await createNode(request.user!.id, request.body as never)
      return reply.code(201).send({ success: true as const, node })
    },
  )

  fastify.patch(
    '/nodes/:id',
    {
      preHandler: requireAuth,
      schema: {
        description:
          'Update any book, arc, chapter or scene. Set deleted:true to soft-delete, deleted:false to restore.',
        tags: ['nodes'],
        params: nodeIdParamSchema,
        body: updateNodeBodySchema,
        response: {
          200: z.strictObject({ success: z.literal(true), node: nodeResultSchema }),
          400: errorSchema,
          401: errorSchema,
          404: errorSchema,
        },
      },
    },
    async (request) => {
      const node = await updateNode(request.user!.id, request.params.id, request.body as never)
      return { success: true as const, node }
    },
  )

  fastify.post(
    '/nodes/:id/move',
    {
      preHandler: requireAuth,
      schema: {
        description:
          'Reorder a node among its siblings and/or reparent it. Siblings are renumbered 0..n-1 in one transaction.',
        tags: ['nodes'],
        params: nodeIdParamSchema,
        body: moveNodeBodySchema,
        response: {
          200: z.strictObject({ success: z.literal(true), node: nodeResultSchema }),
          400: errorSchema,
          401: errorSchema,
          404: errorSchema,
        },
      },
    },
    async (request) => {
      const node = await moveNode(request.user!.id, request.params.id, request.body)
      return { success: true as const, node }
    },
  )

  fastify.get(
    '/nodes/:id/content',
    {
      preHandler: requireAuth,
      schema: {
        description:
          'Read the prose under a node in one request, with paragraph IDs attached so the result can be edited ' +
          'directly. Refuses with 413 and a per-chapter breakdown when the subtree exceeds maxWords.',
        tags: ['nodes'],
        params: nodeIdParamSchema,
        querystring: contentQuerySchema,
        response: {
          200: contentResponseSchema,
          400: errorSchema,
          401: errorSchema,
          404: errorSchema,
          413: errorSchema,
        },
      },
    },
    async (request) => {
      return await readContent(request.user!.id, request.params.id, {
        maxWords: request.query.maxWords,
        includeAllMessages: request.query.includeAllMessages,
      })
    },
  )
}

export default nodesRoutes
