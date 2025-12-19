import type { Paragraph } from '@mythweavers/shared'

/**
 * Character data needed by the editor
 */
export interface EditorCharacter {
  id: string
  firstName: string
  middleName?: string
  lastName?: string
  summary?: string
  personality?: string
  personalityQuirks?: string
  likes?: string
  dislikes?: string
  background?: string
  distinguishingFeatures?: string
  age?: string
  gender?: string
  sexualOrientation?: string
  writingStyle?: string
}

/**
 * Location data needed by the editor
 */
export interface EditorLocation {
  id: string
  description: string
}

/**
 * Scene data for the editor
 */
export interface EditorScene {
  id: string
  paragraphs: Paragraph[]
  protagonistId?: string
  perspective?: 'first' | 'third'
  characterIds?: string[]
  referredCharacterIds?: string[]
  locationId?: string
}

/**
 * Tree node for context (book/arc/chapter)
 */
export interface EditorTreeNode {
  id: string
  name: string
  children?: EditorTreeNode[]
}

/**
 * AI generation types
 */
export type AiHelpType =
  | 'rewrite_spelling'
  | 'rewrite'
  | 'snowflake_refine_scene_style'
  | 'snowflake_convert_perspective'
  | 'add_sensory_details'
  | 'generate_between'

/**
 * Props for the SceneEditor component
 */
export interface SceneEditorProps {
  /** Scene ID */
  sceneId: string

  /** Scene data (paragraphs, metadata, etc.) */
  scene: EditorScene

  /** Available characters (for context) */
  characters: Record<string, EditorCharacter>

  /** Available locations (for context) */
  locations: Record<string, EditorLocation>

  /** Tree context (book → arc → chapter) for the current scene */
  treeContext?: {
    book?: EditorTreeNode
    arc?: EditorTreeNode
    chapter: EditorTreeNode
  }

  /** Callback when the full paragraphs array changes (for syncing with parent state) */
  onParagraphsChange?: (paragraphs: Paragraph[]) => void

  /** Callback when paragraph data changes */
  onParagraphUpdate: (paragraphId: string, data: Partial<Paragraph>) => void

  /** Callback to create a new paragraph - returns the ID of the created paragraph */
  onParagraphCreate: (paragraph: Omit<Paragraph, 'id'>, afterId?: string) => string

  /** Callback to delete a paragraph */
  onParagraphDelete: (paragraphId: string) => void

  /** Callback to move paragraph up */
  onParagraphMoveUp: (paragraphId: string) => void

  /** Callback to move paragraph down */
  onParagraphMoveDown: (paragraphId: string) => void

  /** Callback to update selected paragraph */
  onSelectedParagraphChange: (paragraphId: string) => void

  /** Callback when viewpoint character changes */
  onViewpointChange?: (characterId: string | null) => void

  /** Callback when active characters change */
  onActiveCharactersChange?: (characterIds: string[]) => void

  /** Callback when scene goal changes */
  onGoalChange?: (goal: string | null) => void

  /** Callback to split scene at a paragraph */
  onSceneSplit?: (paragraphId: string) => void

  /** Callback for AI help */
  onAiHelp?: () => Promise<void>

  /** Callback for AI rewrite */
  onAiRewrite?: () => Promise<void>

  /** Callback for AI translate */
  onAiTranslate?: () => Promise<void>

  /** Callback for AI generate between */
  onAiBetween?: () => Promise<void>

  /** Callback for AI assistance (legacy) */
  onAiRequest?: (type: AiHelpType, paragraphId: string, customInstructions?: string) => Promise<string | null>

  /** Callback when generate between text is saved to UI state */
  onGenerateBetweenTextSave?: (text: string) => void

  /** Previously saved generate between text (for persistence) */
  savedGenerateBetweenText?: string

  /** Optional: Custom inventory actions component */
  InventoryActionsComponent?: () => any

  /** Optional: Custom plot point actions component */
  PlotpointActionsComponent?: (props: { onClose: () => void }) => any

  /** Optional: Custom audio button component */
  AudioButtonComponent?: (props: { text: string }) => any
}
