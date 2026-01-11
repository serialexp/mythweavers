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

  /** Whether the editor is editable (default: true) */
  editable?: boolean

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

  /** Callback to update selected paragraph */
  onSelectedParagraphChange: (paragraphId: string) => void

  /** Callback when user wants to edit a paragraph's script */
  onParagraphEditScript?: (paragraphId: string) => void

  /** Callback when editor loses focus */
  onBlur?: () => void
}
