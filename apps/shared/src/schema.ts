import z from 'zod'

const entitySchema = z.object({
  id: z.string(),
  modifiedAt: z.number().or(z.string()).optional(),
})

const plotPointSchema = entitySchema.extend({
  id: z.string(),
  summary: z.string(),
  title: z.string(),
  state: z.enum(['introduced', 'unresolved', 'resolved']).default('unresolved'),
})

export type PlotPoint = z.infer<typeof plotPointSchema>

const characterSchema = entitySchema.extend({
  picture: z.string(),
  /** @deprecated Use firstName, middleName, lastName instead */
  name: z.string().optional(),
  firstName: z.string(),
  middleName: z.string().optional(),
  lastName: z.string().optional(),
  nickname: z.string().optional(),
  summary: z.string(),
  background: z.string().optional(),
  personality: z.string().optional(),
  personalityQuirks: z.string().optional(),
  likes: z.string().optional(),
  dislikes: z.string().optional(),
  age: z.string(),
  gender: z.string().optional(),
  sexualOrientation: z.string().optional(),
  height: z.number().optional().default(170),
  hairColor: z.string().optional(),
  eyeColor: z.string().optional(),
  distinguishingFeatures: z.string().optional(),
  writingStyle: z.string().optional(),
  isMainCharacter: z.boolean().default(true),
  laterVersionOf: z.string().optional(),
  significantActions: z
    .array(
      z.object({
        action: z.string(),
        sceneId: z.string(),
        timestamp: z.number(),
      }),
    )
    .optional(),
})
export type Character = z.infer<typeof characterSchema>

const treeDataSchema = entitySchema.extend({
  title: z.string(),
  extra: z.string().optional(),
})

export type TreeData = z.infer<typeof treeDataSchema>

const bookSchema = treeDataSchema.extend({
  summary: z.string(),
  author: z.string().optional(),
  editor: z.string().optional(),
  coverArtist: z.string().optional(),
  critique: z.string().optional(),
  coverImage: z.string().optional(),
  spineImage: z.string().optional(),
  separatorImage: z.string().optional(),
  start_date: z.string().optional(),
})

export type Book = z.infer<typeof bookSchema>

const arcSchema = treeDataSchema.extend({
  summary: z.string(),
  start_date: z.string().optional(),
  highlights: z
    .array(
      z.object({
        text: z.string(),
        importance: z.string(),
        category: z.enum(['character', 'plot', 'setting', 'theme']),
        timestamp: z.number(),
      }),
    )
    .optional(),
})

export type Arc = z.infer<typeof arcSchema>

const chapterSchema = treeDataSchema.extend({
  summary: z.string(),
  start_date: z.string().optional(),
  visibleFrom: z.string().datetime().optional(),
  royalRoadId: z.number().optional(),
})

export type Chapter = z.infer<typeof chapterSchema>

const inventoryActionSchema = z.object({
  type: z.enum(['add', 'remove']),
  item_name: z.string(),
  item_amount: z.number(),
})

export type InventoryAction = z.infer<typeof inventoryActionSchema>

const plotpointActionSchema = z.object({
  plot_point_id: z.string(),
  action: z.enum(['introduce', 'mentioned', 'partially resolved', 'resolved']),
})

export type PlotpointAction = z.infer<typeof plotpointActionSchema>

export const textNodeSchema = z.object({
  type: z.literal('text'),
  text: z.string(),
  marks: z
    .array(
      z.object({
        type: z.literal('translation'),
        attrs: z.object({
          title: z.string(),
          from: z.string(),
          to: z.string(),
        }),
      }),
    )
    .optional(),
})

export const blockNodeSchema = z.object({
  type: z.literal('paragraph'),
  content: z.array(textNodeSchema).optional(),
})

export const contentNodeSchema = z
  .object({
    type: z.literal('doc'),
    content: z.array(blockNodeSchema),
  })
  .passthrough()

export type ContentNode = z.infer<typeof contentNodeSchema>
export type TextNode = z.infer<typeof textNodeSchema>
export type BlockNode = z.infer<typeof blockNodeSchema>
export type TextMark = NonNullable<TextNode['marks']>[number]

const sceneParagraphSchema = entitySchema.extend({
  text: z.string().or(contentNodeSchema),
  words: z.number().optional(),
  aiCharacters: z.number().optional(),
  humanCharacters: z.number().optional(),
  extra: z.string().optional(),
  translation: z.string().optional(),
  extraLoading: z.boolean().optional(),
  state: z.enum(['ai', 'draft', 'revise', 'final', 'sdt']),
  comments: z.array(
    z.object({
      text: z.string(),
      user: z.string(),
      createdAt: z.string(),
    }),
  ),
  plot_point_actions: z.array(plotpointActionSchema).optional(),
  inventory_actions: z.array(inventoryActionSchema).optional(),
})

export type SceneParagraph = z.infer<typeof sceneParagraphSchema>

const sceneSchema = treeDataSchema.extend({
  summary: z.string(),
  paragraphs: z.array(sceneParagraphSchema),
  text: z.string(),
  selectedParagraph: z.string().optional(),
  words: z.number().optional(),
  generateNextText: z.string().optional(),
  hasAI: z.boolean().optional(),
  posted: z.boolean().optional(),
  cursor: z.number().optional(),
  plot_point_actions: z.array(
    z.object({
      plot_point_id: z.string(),
      action: z.string(),
    }),
  ),
  perspective: z.enum(['first', 'third']).optional(),
  protagonistId: z.string().optional(),
  characterIds: z.array(z.string()).optional(),
  referredCharacterIds: z.array(z.string()).optional(),
  locationId: z.string().optional(),
  selectedContextNodes: z.array(z.string()).optional(),
  paragraphsToGenerate: z.number().default(1),
  highlights: z
    .array(
      z.object({
        text: z.string(),
        importance: z.string(),
        category: z.enum(['character', 'plot', 'setting', 'theme']),
        timestamp: z.number(),
      }),
    )
    .optional(),
  lastHighlightsGenerated: z.number().optional(),
  generationApproaches: z
    .array(
      z.object({
        name: z.string(),
        content: z.string(),
        timestamp: z.number(),
      }),
    )
    .optional(),
})

export type Scene = z.infer<typeof sceneSchema>

const baseNodeSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.enum(['book', 'arc', 'chapter', 'scene']),
  isOpen: z.boolean(),
  nodeType: z.enum(['story', 'non-story', 'context']).default('story'),
  oneliner: z.string().optional(),
  summaries: z
    .array(
      z.object({
        level: z.number(),
        text: z.string(),
        timestamp: z.number(),
      }),
    )
    .optional(),
})

export type Node = z.infer<typeof baseNodeSchema> & {
  children?: Node[]
}

const treeSchema: z.ZodType<Node> = baseNodeSchema.extend({
  children: z.lazy(() => treeSchema.array().optional()),
})

export const languageSchema = z.object({
  languages: z.record(
    z.string(),
    z.object({
      id: z.string(),
      summary: z.string(),
      title: z.string(),
      phonemes: z.array(
        z.object({
          id: z.string(),
          identifier: z.string(),
          options: z.string(),
        }),
      ),
      wordOptions: z.array(
        z.object({
          id: z.string(),
          identifier: z.string(),
          option: z.string(),
        }),
      ),
      vocabulary: z.array(
        z.object({
          id: z.string(),
          native: z.string(),
          meaning: z.string(),
        }),
      ),
      pronouns: z.array(
        z.object({
          id: z.string(),
          native: z.string(),
          meaning: z.string(),
        }),
      ),
    }),
  ),
})

export type Language = z.infer<typeof languageSchema>

const itemSchema = entitySchema.extend({
  name: z.string(),
})

export type Item = z.infer<typeof itemSchema>

export const storySettingsSchema = z.object({
  headerImage: z.string().optional(),
  mangaChapterPath: z.string().optional(),
  aiInstructions: z.string().optional(),
  royalRoadId: z.string().optional(),
  defaultPerspective: z.enum(['first', 'third']).default('third'),
  defaultProtagonistId: z.string().optional(),
  publishToRoyalRoad: z.boolean().optional(),
})

export type StorySettings = z.infer<typeof storySettingsSchema>

export const uploadedFileSchema = z.object({
  hash: z.string(),
  publicUrl: z.string(),
})

export type UploadedFile = z.infer<typeof uploadedFileSchema>

const locationSchema = entitySchema.extend({
  name: z.string(),
  picture: z.string(),
  description: z.string(),
})
export type Location = z.infer<typeof locationSchema>

export const storySchema = z.object({
  id: z.string(),
  name: z.string(),
  modifiedTime: z.number(),
  lastPublishTime: z.number().optional(),
  settings: storySettingsSchema.optional(),
  uploadedFiles: z.record(z.string(), uploadedFileSchema).optional(),
  item: z.record(z.string(), itemSchema).optional(),
  structure: z.array(treeSchema),
  chapter: z.record(z.string(), chapterSchema),
  book: z.record(z.string(), bookSchema),
  arc: z.record(z.string(), arcSchema),
  characters: z.record(z.string(), characterSchema),
  locations: z.record(z.string(), locationSchema),
  plotPoints: z.record(z.string(), plotPointSchema),
  scene: z.record(z.string(), sceneSchema),
  oneliner: z.string().optional(),
})
export type Story = z.infer<typeof storySchema>

export const persistedSchema = z.object({
  story: storySchema,
  language: languageSchema,
})
export type PersistedStory = z.infer<typeof persistedSchema>

export const saveSchema = persistedSchema.extend({
  newAutosave: z.boolean(),
  expectedLastModified: z.number(),
  changesSince: z.number().optional(),
})

export type SavePayload = z.infer<typeof saveSchema>

export const entities = ['item', 'scene', 'book', 'arc', 'chapter', 'characters', 'locations', 'plotPoints'] as const

export const languageEntities = ['languages'] as const
