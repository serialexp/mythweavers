import { contentSchemaToText } from '../content-schema-to-html.js'
import type {
  Arc,
  Book,
  Chapter,
  Character,
  ContentNode,
  Language,
  Location,
  PlotPoint,
  Scene,
  SceneParagraph,
  Story,
} from '../schema.js'

/**
 * Format a character for LLM context
 */
export function characterToMarkdown(character: Character): string {
  const parts: string[] = []

  // Build name from parts
  const nameParts = []
  if (character.firstName) nameParts.push(character.firstName)
  if (character.middleName) nameParts.push(character.middleName)
  if (character.lastName) nameParts.push(character.lastName)
  const fullName = nameParts.join(' ') || character.name || 'Unnamed Character'

  parts.push(`# Character: ${fullName}`)

  if (character.nickname) {
    parts.push(`\n*Also known as: ${character.nickname}*`)
  }

  if (character.summary) {
    parts.push(`\n## Summary\n${character.summary}`)
  }

  if (character.background) {
    parts.push(`\n## Background\n${character.background}`)
  }

  if (character.personality) {
    parts.push(`\n## Personality\n${character.personality}`)
  }

  if (character.personalityQuirks) {
    parts.push(`\n## Personality Quirks\n${character.personalityQuirks}`)
  }

  if (character.likes) {
    parts.push(`\n## Likes\n${character.likes}`)
  }

  if (character.dislikes) {
    parts.push(`\n## Dislikes\n${character.dislikes}`)
  }

  // Basic info
  const basicInfo: string[] = []
  if (character.age) basicInfo.push(`Age: ${character.age}`)
  if (character.gender) basicInfo.push(`Gender: ${character.gender}`)
  if (character.height) basicInfo.push(`Height: ${character.height}cm`)
  if (character.sexualOrientation) basicInfo.push(`Sexual Orientation: ${character.sexualOrientation}`)

  if (basicInfo.length > 0) {
    parts.push(`\n## Basic Information\n${basicInfo.join('\n')}`)
  }

  // Physical appearance
  const appearance: string[] = []
  if (character.hairColor) appearance.push(`Hair Color: ${character.hairColor}`)
  if (character.eyeColor) appearance.push(`Eye Color: ${character.eyeColor}`)
  if (character.distinguishingFeatures) appearance.push(`Distinguishing Features: ${character.distinguishingFeatures}`)

  if (appearance.length > 0) {
    parts.push(`\n## Physical Appearance\n${appearance.join('\n')}`)
  }

  if (character.writingStyle) {
    parts.push(`\n## Writing Style\n${character.writingStyle}`)
  }

  if (character.significantActions && character.significantActions.length > 0) {
    parts.push('\n## Significant Actions')
    for (const action of character.significantActions) {
      parts.push(`- ${action.action}`)
    }
  }

  return parts.join('\n')
}

/**
 * Format a location for LLM context
 */
export function locationToMarkdown(location: Location): string {
  const parts: string[] = []

  parts.push(`# Location: ${location.name}`)

  if (location.description) {
    parts.push(`\n${location.description}`)
  }

  return parts.join('\n')
}

/**
 * Format a plot point for LLM context
 */
export function plotPointToMarkdown(plotPoint: PlotPoint): string {
  const parts: string[] = []

  parts.push(`# Plot Point: ${plotPoint.title}`)

  parts.push(`\n**Status**: ${plotPoint.state}`)

  if (plotPoint.summary) {
    parts.push(`\n${plotPoint.summary}`)
  }

  return parts.join('\n')
}

/**
 * Convert content node to text if it's a ContentNode
 */
function getTextFromContent(content: string | ContentNode): string {
  if (typeof content === 'string') {
    return content
  }
  return contentSchemaToText(content)
}

/**
 * Format a scene for LLM context
 */
export function sceneToMarkdown(scene: Scene, paragraphs?: SceneParagraph[]): string {
  const parts: string[] = []

  parts.push(`# Scene: ${scene.title}`)

  if (scene.summary) {
    parts.push(`\n## Summary\n${scene.summary}`)
  }

  // Use paragraphs from the scene if provided
  const sceneParagraphs = paragraphs || scene.paragraphs

  if (sceneParagraphs && sceneParagraphs.length > 0) {
    parts.push('\n## Content')
    for (const paragraph of sceneParagraphs) {
      if (paragraph.state === 'ai') {
        parts.push('\n*[AI Generated Content]*')
      }
      const text = getTextFromContent(paragraph.text)
      if (text) {
        parts.push(`\n${text}`)
      }
    }
  }

  return parts.join('\n')
}

/**
 * Format a chapter for LLM context
 */
export function chapterToMarkdown(chapter: Chapter, scenes?: Scene[]): string {
  const parts: string[] = []

  parts.push(`# Chapter: ${chapter.title}`)

  if (chapter.summary) {
    parts.push(`\n## Summary\n${chapter.summary}`)
  }

  if (scenes && scenes.length > 0) {
    parts.push('\n## Scenes')
    for (const scene of scenes) {
      parts.push(`\n### ${scene.title}`)
      if (scene.summary) {
        parts.push(`${scene.summary}`)
      }
    }
  }

  return parts.join('\n')
}

/**
 * Format an arc for LLM context
 */
export function arcToMarkdown(arc: Arc, chapters?: Chapter[]): string {
  const parts: string[] = []

  parts.push(`# Arc: ${arc.title}`)

  if (arc.summary) {
    parts.push(`\n## Summary\n${arc.summary}`)
  }

  if (chapters && chapters.length > 0) {
    parts.push('\n## Chapters')
    for (const chapter of chapters) {
      parts.push(`\n- ${chapter.title}`)
    }
  }

  return parts.join('\n')
}

/**
 * Format a book for LLM context
 */
export function bookToMarkdown(book: Book, arcs?: Arc[]): string {
  const parts: string[] = []

  parts.push(`# Book: ${book.title}`)

  if (book.summary) {
    parts.push(`\n## Summary\n${book.summary}`)
  }

  if (book.author) {
    parts.push(`\n**Author**: ${book.author}`)
  }

  if (arcs && arcs.length > 0) {
    parts.push('\n## Arcs')
    for (const arc of arcs) {
      parts.push(`\n- ${arc.title}`)
    }
  }

  return parts.join('\n')
}

/**
 * Format a story for LLM context
 */
export function storyToMarkdown(story: Story, books?: Book[]): string {
  const parts: string[] = []

  parts.push(`# Story: ${story.name}`)

  if (story.oneliner) {
    parts.push(`\n*${story.oneliner}*`)
  }

  if (story.settings?.aiInstructions) {
    parts.push(`\n## AI Instructions\n${story.settings.aiInstructions}`)
  }

  const characterCount = Object.keys(story.characters || {}).length
  const locationCount = Object.keys(story.locations || {}).length
  const plotPointCount = Object.keys(story.plotPoints || {}).length

  parts.push('\n## Statistics')
  parts.push(`- Characters: ${characterCount}`)
  parts.push(`- Locations: ${locationCount}`)
  parts.push(`- Plot Points: ${plotPointCount}`)

  if (books && books.length > 0) {
    parts.push('\n## Books')
    for (const book of books) {
      parts.push(`\n- ${book.title}`)
    }
  }

  return parts.join('\n')
}

/**
 * Format a language for LLM context
 */
export function languageToMarkdown(language: Language): string {
  const parts: string[] = []

  // Language is a wrapper object with languages property
  const languages = Object.values(language.languages || {}) as Array<{
    id: string
    summary: string
    title: string
    phonemes: Array<{ id: string; identifier: string; options: string }>
    wordOptions: Array<{ id: string; identifier: string; option: string }>
    vocabulary: Array<{ id: string; native: string; meaning: string }>
    pronouns: Array<{ id: string; native: string; meaning: string }>
  }>

  if (languages.length === 0) {
    return '# No languages defined'
  }

  for (const lang of languages) {
    parts.push(`# Language: ${lang.title}`)

    if (lang.summary) {
      parts.push(`\n${lang.summary}`)
    }

    if (lang.phonemes && lang.phonemes.length > 0) {
      parts.push('\n## Phonemes')
      for (const phoneme of lang.phonemes) {
        parts.push(`- ${phoneme.identifier}: ${phoneme.options}`)
      }
    }

    if (lang.vocabulary && lang.vocabulary.length > 0) {
      parts.push('\n## Vocabulary')
      for (const word of lang.vocabulary) {
        parts.push(`- ${word.native}: ${word.meaning}`)
      }
    }

    if (lang.pronouns && lang.pronouns.length > 0) {
      parts.push('\n## Pronouns')
      for (const pronoun of lang.pronouns) {
        parts.push(`- ${pronoun.native}: ${pronoun.meaning}`)
      }
    }
  }

  return parts.join('\n\n')
}
