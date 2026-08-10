/**
 * The story tool surface.
 *
 * Six tools, deliberately. The alternative — one tool per entity per operation
 * — produces thirty-odd near-identical tools that all have to be described,
 * kept consistent, and held in the model's head at once. Here the *kind* of
 * thing being created is derived from its parent rather than chosen from a
 * menu, and operations that differ only in target are options on one tool.
 *
 * Every handler delegates to services/story, which is the same code the REST
 * routes under /my use. Nothing story-related is implemented twice.
 *
 * Tool definitions are transport-agnostic on purpose: this module is consumed
 * by the HTTP MCP endpoint today, and can be handed to the Agent SDK's
 * `createSdkMcpServer` unchanged for an in-editor agent later.
 */

import { z } from 'zod'
import { badRequest } from '../services/story/errors.js'
import {
  type EntityKind,
  type ProseEdit,
  applyProseEdits,
  createNode,
  deleteEntity,
  flattenOutline,
  getOutline,
  listEntities,
  listStories,
  moveNode,
  readContent,
  searchStory,
  updateNode,
  upsertEntity,
} from '../services/story/index.js'
import { formatContent, formatEntities, formatOutline, formatSearch, formatStoryList } from './format.js'

export interface ToolContext {
  userId: number
  /**
   * Story to assume when a tool is called without one. Lets a session be
   * pinned to a single story so the id doesn't have to be repeated.
   */
  defaultStoryId?: string
}

export interface StoryTool {
  name: string
  description: string
  inputSchema: z.ZodRawShape
  handler: (args: Record<string, unknown>, context: ToolContext) => Promise<string>
}

function requireStoryId(args: Record<string, unknown>, context: ToolContext): string {
  const storyId = (args.storyId as string | undefined) ?? context.defaultStoryId
  if (!storyId) {
    throw badRequest('storyId is required. Call mw_outline with no arguments to list your stories.')
  }
  return storyId
}

// ============================================================================
// Shared field definitions
// ============================================================================

const NODE_FIELD_SCHEMA = {
  summary: z.string().nullish().describe('Full summary. Any node kind.'),
  sentenceSummary: z.string().nullish().describe('One-sentence Snowflake summary. Any node kind.'),
  paragraphSummary: z.string().nullish().describe('Paragraph-length Snowflake summary. Any node kind.'),
  nodeType: z
    .enum(['story', 'non-story', 'context'])
    .nullish()
    .describe('Whether this node is part of the narrative. Books, arcs and chapters only.'),
  status: z.string().nullish().describe('draft | needs_work | review | done. Chapters and scenes only.'),
  pages: z.number().int().nullish().describe('Page count. Books only.'),
  includeInFull: z
    .number()
    .int()
    .nullish()
    .describe('0 = excluded from AI context, 1 = summary only, 2 = full content. Scenes only.'),
  perspective: z.enum(['FIRST', 'SECOND', 'THIRD']).nullish().describe('Narrative perspective. Scenes only.'),
  viewpointCharacterId: z.string().nullish().describe('POV character id. Scenes only.'),
  activeCharacterIds: z.array(z.string()).nullish().describe('Characters present in the scene. Scenes only.'),
  activeContextItemIds: z.array(z.string()).nullish().describe('Context items active in the scene. Scenes only.'),
  goal: z.string().nullish().describe('What this scene needs to accomplish. Scenes only.'),
  storyTime: z.number().int().nullish().describe('When the scene occurs in story time, in minutes. Scenes only.'),
}

const CHARACTER_FIELD_SCHEMA = {
  firstName: z.string().optional().describe('Required when creating a character.'),
  middleName: z.string().nullish(),
  lastName: z.string().nullish(),
  nickname: z.string().nullish(),
  description: z
    .string()
    .nullish()
    .describe(
      'The field that feeds AI generation, for both characters and context items. Supports EJS templating. ' +
        'This is the important one.',
    ),
  background: z.string().nullish(),
  personality: z.string().nullish(),
  personalityQuirks: z.string().nullish(),
  likes: z.string().nullish(),
  dislikes: z.string().nullish(),
  age: z.string().nullish().describe('Free text — "late thirties" is as valid as "37".'),
  gender: z.string().nullish(),
  sexualOrientation: z.string().nullish(),
  height: z.number().int().nullish().describe('Centimetres.'),
  hairColor: z.string().nullish(),
  eyeColor: z.string().nullish(),
  distinguishingFeatures: z.string().nullish(),
  writingStyle: z.string().nullish().describe('How prose should read when this character holds the POV.'),
  isMainCharacter: z.boolean().optional(),
  birthdate: z.number().int().nullish().describe('Birth date in story time.'),
}

const CONTEXT_ITEM_FIELD_SCHEMA = {
  type: z.enum(['theme', 'location', 'plot']).optional().describe('Required when creating a context item.'),
  name: z.string().optional().describe('Required when creating a context item.'),
  isGlobal: z.boolean().optional().describe('Active in every chapter rather than only where referenced.'),
}

// ============================================================================
// Tools
// ============================================================================

export const STORY_TOOLS: StoryTool[] = [
  {
    name: 'mw_outline',
    description:
      'Read the structure of a story without any prose: books, arcs, chapters and optionally scenes, with ids, ' +
      'word counts and status. Call with no arguments to list your stories. This is the cheap way to navigate — ' +
      'always orient here before reading content.',
    inputSchema: {
      storyId: z.string().optional().describe('Omit entirely to list all your stories.'),
      rootId: z.string().optional().describe('Limit the outline to the subtree under this node.'),
      depth: z
        .enum(['book', 'arc', 'chapter', 'scene'])
        .optional()
        .describe('Deepest level to include. Defaults to chapter; use scene when you need POV or scene ids.'),
      includeSummaries: z.boolean().optional().describe("Include each node's summaries. Costs tokens on a long story."),
    },
    handler: async (args, context) => {
      const storyId = (args.storyId as string | undefined) ?? context.defaultStoryId
      if (!storyId && !args.rootId) {
        return formatStoryList(await listStories(context.userId))
      }

      const outline = await getOutline(context.userId, storyId ?? (args.rootId as string), {
        rootId: args.rootId as string | undefined,
        depth: args.depth as 'book' | 'arc' | 'chapter' | 'scene' | undefined,
        includeSummaries: args.includeSummaries as boolean | undefined,
        includeSceneDetail: args.depth === 'scene',
      })
      return formatOutline(outline, flattenOutline(outline.nodes))
    },
  },

  {
    name: 'mw_read',
    description:
      'Read the prose under a chapter or scene. Every paragraph comes back tagged with its id as [p:<id>] — pass ' +
      'those ids to mw_prose to edit them. Refuses with a per-chapter breakdown if the subtree is larger than ' +
      'maxWords, so reading a whole book by accident is not possible.',
    inputSchema: {
      nodeId: z.string().describe('A chapter or scene id. Books and arcs work too if they fit within maxWords.'),
      maxWords: z
        .number()
        .int()
        .positive()
        .optional()
        .describe('Word ceiling for this read. Defaults to 6000. Raise it deliberately, not reflexively.'),
    },
    handler: async (args, context) => {
      const content = await readContent(context.userId, args.nodeId as string, {
        maxWords: args.maxWords as number | undefined,
      })
      return formatContent(content)
    },
  },

  {
    name: 'mw_search',
    description:
      'Case-insensitive substring search across prose, character sheets, context items and node summaries. Use ' +
      'this for continuity questions — "where did I mention the amulet", "which scenes have Mara in them". ' +
      'Matches are literal substrings, not semantic, so search for distinctive words rather than concepts.',
    inputSchema: {
      query: z.string().min(2).describe('Literal text to find. At least 2 characters.'),
      storyId: z.string().optional().describe('Defaults to the pinned story if the session has one.'),
      scope: z
        .enum(['prose', 'characters', 'context', 'summaries', 'all'])
        .optional()
        .describe('Narrow the search. Defaults to all.'),
      limit: z.number().int().min(1).max(200).optional().describe('Maximum hits per scope. Defaults to 40.'),
    },
    handler: async (args, context) => {
      const result = await searchStory(context.userId, requireStoryId(args, context), args.query as string, {
        scope: args.scope as 'prose' | 'characters' | 'context' | 'summaries' | 'all' | undefined,
        limit: args.limit as number | undefined,
      })
      return formatSearch(result)
    },
  },

  {
    name: 'mw_node',
    description:
      'Create, update, move or delete a structural node. The kind is derived, never chosen: pass parentId to ' +
      'create (story→book, book→arc, arc→chapter, chapter→scene), or nodeId to update an existing one. Set ' +
      'deleted:true to soft-delete and deleted:false to restore. Fields that do not apply to the derived kind ' +
      'are rejected by name, so a wrong guess is a recoverable error rather than a silent no-op.',
    inputSchema: {
      parentId: z.string().optional().describe('Create a child of this node. Mutually exclusive with nodeId.'),
      nodeId: z.string().optional().describe('Update this node. Mutually exclusive with parentId.'),
      name: z.string().optional().describe('Required when creating.'),
      position: z
        .union([z.literal('start'), z.literal('end'), z.number().int().min(0)])
        .optional()
        .describe('Where among its siblings. Defaults to end. Siblings are renumbered to stay contiguous.'),
      moveToParentId: z.string().optional().describe('Reparent an existing node. Must accept the same kind.'),
      deleted: z.boolean().optional().describe('Soft-delete or restore. Update only.'),
      ...NODE_FIELD_SCHEMA,
    },
    handler: async (args, context) => {
      const { parentId, nodeId, moveToParentId, ...rest } = args

      if (parentId && nodeId) {
        throw badRequest('Pass parentId to create a node or nodeId to update one, not both.')
      }
      if (!parentId && !nodeId) {
        throw badRequest('Pass parentId to create a node, or nodeId to update an existing one.')
      }

      const fields = stripUndefined(rest)

      if (parentId) {
        const node = await createNode(context.userId, {
          parentId: parentId as string,
          name: fields.name as string,
          ...fields,
        })
        return `Created ${node.kind} "${node.name}" [${node.kind}:${node.id}] at position ${node.sortOrder}.`
      }

      if (moveToParentId) {
        const moved = await moveNode(context.userId, nodeId as string, {
          parentId: moveToParentId as string,
          position: fields.position as 'start' | 'end' | number | undefined,
        })
        return `Moved ${moved.kind} "${moved.name}" under [${moved.parentId}] at position ${moved.sortOrder}.`
      }

      const node = await updateNode(context.userId, nodeId as string, fields)
      if (fields.deleted === true) {
        return `Soft-deleted ${node.kind} "${node.name}" [${node.kind}:${node.id}]. Set deleted:false to restore.`
      }
      return `Updated ${node.kind} "${node.name}" [${node.kind}:${node.id}].`
    },
  },

  {
    name: 'mw_prose',
    description:
      'Edit prose. Takes a batch of edits applied in order inside one transaction — if any fails, none are ' +
      'applied. Blank lines in text split it into separate paragraphs. Every write creates a new revision, so ' +
      'edits are reversible.\n\n' +
      'replace requires `expect`: the opening words of the paragraph as you last read it. If the paragraph no ' +
      "longer starts with that, the edit is rejected rather than overwriting someone else's change. Read the " +
      'scene with mw_read first and copy the text from there.',
    inputSchema: {
      edits: z
        .array(
          z.object({
            op: z
              .enum(['replace', 'insert_after', 'insert_before', 'append', 'delete'])
              .describe('append adds a new message at the end of a scene; the rest act on an existing paragraph.'),
            paragraphId: z.string().optional().describe('Target paragraph. Required for all ops except append.'),
            sceneId: z.string().optional().describe('Target scene. Required for append.'),
            text: z.string().optional().describe('New text. Required for everything except delete.'),
            expect: z
              .string()
              .optional()
              .describe('Opening text of the paragraph being replaced. Required for replace, optional for delete.'),
            state: z
              .enum(['AI', 'DRAFT', 'REVISE', 'FINAL', 'SDT'])
              .optional()
              .describe('Mark the written paragraphs with this state.'),
          }),
        )
        .min(1)
        .max(200),
    },
    handler: async (args, context) => {
      const result = await applyProseEdits(context.userId, args.edits as ProseEdit[])
      const parts = [`Applied ${result.applied} edit${result.applied === 1 ? '' : 's'}.`]
      if (result.updated.length) parts.push(`Revised: ${result.updated.join(', ')}`)
      if (result.created.length) parts.push(`Created: ${result.created.join(', ')}`)
      if (result.deleted.length) parts.push(`Deleted: ${result.deleted.join(', ')}`)
      return parts.join('\n')
    },
  },

  {
    name: 'mw_entity',
    description:
      'Read and write the story bible: characters and context items (themes, locations, plot threads). Omit id ' +
      "to create, pass id to update, pass list:true to see everything. A character's `description` is the field " +
      'that actually feeds AI generation — the rest are for your own reference.',
    inputSchema: {
      kind: z.enum(['character', 'contextItem']).optional().describe('Required unless list:true.'),
      storyId: z.string().optional().describe('Defaults to the pinned story if the session has one.'),
      id: z.string().optional().describe('Omit to create, pass to update or delete.'),
      list: z.boolean().optional().describe('List all characters and context items instead of writing.'),
      delete: z.boolean().optional().describe('Delete the entity named by id. This is permanent — no soft-delete.'),
      // CHARACTER_FIELD_SCHEMA carries `description`, which both kinds share.
      ...CHARACTER_FIELD_SCHEMA,
      ...CONTEXT_ITEM_FIELD_SCHEMA,
    },
    handler: async (args, context) => {
      const storyId = requireStoryId(args, context)
      const { kind, id, list, delete: remove, storyId: _ignored, ...rest } = args

      if (list) {
        return formatEntities(await listEntities(context.userId, storyId, kind as EntityKind | undefined))
      }

      if (!kind) {
        throw badRequest('kind is required ("character" or "contextItem") unless you pass list:true.')
      }

      if (remove) {
        if (!id) throw badRequest('id is required to delete an entity.')
        const deleted = await deleteEntity(context.userId, storyId, kind as EntityKind, id as string)
        return `Deleted ${deleted.kind} "${deleted.name}".`
      }

      const result = await upsertEntity(context.userId, {
        storyId,
        kind: kind as EntityKind,
        id: id as string | undefined,
        ...stripUndefined(rest),
      })
      return `${result.created ? 'Created' : 'Updated'} ${result.kind} "${result.name}" [${result.kind}:${result.id}].`
    },
  },
]

/**
 * Drop keys the caller didn't set. MCP clients routinely send every declared
 * optional property as `undefined`, and the services treat "present" as
 * "intended", so passing them straight through would make every update look
 * like it meant to clear a dozen fields.
 */
function stripUndefined(input: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(input)) {
    if (value !== undefined) out[key] = value
  }
  return out
}
