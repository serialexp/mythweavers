/**
 * Batched prose editing.
 *
 * One request, one transaction, all-or-nothing. Existing paragraph endpoints
 * stay as they are — this is for callers making several related edits that
 * must not land half-applied.
 */

import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { requireAuth } from '../../lib/auth.js'
import { errorSchema } from '../../schemas/common.js'
import { applyProseEdits } from '../../services/story/index.js'

const paragraphStateSchema = z.enum(['AI', 'DRAFT', 'REVISE', 'FINAL', 'SDT']).meta({
  description: 'Paragraph state to apply to the written text',
  example: 'DRAFT',
})

const textSchema = z.string().min(1).meta({
  description: 'Paragraph text. Blank lines split it into multiple paragraphs.',
  example: 'The river ran black under the bridge.\n\nMara counted the guards twice.',
})

const proseEditSchema = z.discriminatedUnion('op', [
  z.strictObject({
    op: z.literal('replace'),
    paragraphId: z.string().meta({ description: 'Paragraph to overwrite', example: 'clx1234567890' }),
    text: textSchema,
    expect: z
      .string()
      .min(1)
      .meta({
        description:
          'The opening text of the paragraph as you last read it. The edit is rejected with 409 if the paragraph ' +
          'no longer starts with this, so a concurrent edit cannot be silently overwritten. Compared after ' +
          'stripping tags and collapsing whitespace.',
        example: 'The river ran black',
      }),
    state: paragraphStateSchema.optional(),
  }),
  z.strictObject({
    op: z.literal('insert_after'),
    paragraphId: z.string(),
    text: textSchema,
    state: paragraphStateSchema.optional(),
  }),
  z.strictObject({
    op: z.literal('insert_before'),
    paragraphId: z.string(),
    text: textSchema,
    state: paragraphStateSchema.optional(),
  }),
  z.strictObject({
    op: z.literal('append'),
    sceneId: z.string().meta({ description: 'Scene to append a new message to', example: 'clx1234567890' }),
    text: textSchema,
    state: paragraphStateSchema.optional(),
  }),
  z.strictObject({
    op: z.literal('delete'),
    paragraphId: z.string(),
    expect: z.string().optional().meta({
      description: 'Optional guard, same semantics as on replace.',
    }),
  }),
])

const proseEditsBodySchema = z.strictObject({
  edits: z.array(proseEditSchema).min(1).max(200).meta({
    description: 'Edits to apply in order, in a single transaction. If any fails, none are applied.',
  }),
})

const proseEditsResponseSchema = z.strictObject({
  success: z.literal(true),
  applied: z.number().int().meta({ description: 'Number of edits applied', example: 3 }),
  created: z.array(z.string()).meta({ description: 'IDs of paragraphs created' }),
  updated: z.array(z.string()).meta({ description: 'IDs of paragraphs given a new revision' }),
  deleted: z.array(z.string()).meta({ description: 'IDs of paragraphs removed' }),
  chaptersRecounted: z.array(z.string()).meta({ description: 'Chapters whose cached word count was refreshed' }),
})

const proseRoutes: FastifyPluginAsyncZod = async (fastify) => {
  fastify.post(
    '/prose/edits',
    {
      preHandler: requireAuth,
      schema: {
        description:
          'Apply a batch of paragraph edits transactionally. Every write creates a new ParagraphRevision, so ' +
          'edits are reversible from revision history.',
        tags: ['prose'],
        body: proseEditsBodySchema,
        response: {
          200: proseEditsResponseSchema,
          400: errorSchema,
          401: errorSchema,
          404: errorSchema,
          409: errorSchema,
        },
      },
    },
    async (request) => {
      const result = await applyProseEdits(request.user!.id, request.body.edits as never)
      return { success: true as const, ...result }
    },
  )
}

export default proseRoutes
