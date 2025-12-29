import { StorySetting } from './types'

export interface StoryFormat {
  value: 'narrative' | 'cyoa'
  label: string
}

export const STORY_FORMATS: StoryFormat[] = [
  { value: 'narrative', label: 'Narrative' },
  { value: 'cyoa', label: 'Choose Your Own Adventure' },
]

export const STORY_SETTINGS: StorySetting[] = [
  { value: '', label: 'No specific setting' },
  { value: 'fantasy', label: 'Fantasy' },
  { value: 'scifi', label: 'Science Fiction' },
  { value: 'mystery', label: 'Mystery/Thriller' },
  { value: 'romance', label: 'Romance' },
  { value: 'horror', label: 'Horror' },
  { value: 'adventure', label: 'Adventure' },
  { value: 'historical', label: 'Historical Fiction' },
  { value: 'dystopian', label: 'Dystopian' },
  { value: 'comedy', label: 'Comedy' },
]

export const DEFAULT_CHARS_PER_TOKEN = 3.5
export const DEFAULT_CONTEXT_SIZE = 8192
export const CONTEXT_SIZE_STEP = 4096
