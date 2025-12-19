import { Node } from '@writer/shared'
import shortUUID from 'short-uuid'
import { gatherContext } from '../../../lib/embeddings/gather-context'
import { contentSchemaToText } from '../../../lib/persistence/content-schema-to-html'
import { arcsStore } from '../../../lib/stores/arcs'
import { charactersState } from '../../../lib/stores/characters'
import { locationsState } from '../../../lib/stores/locations'
import { addNotification } from '../../../lib/stores/notifications'
import { createSceneParagraph, scenesState, updateSceneData } from '../../../lib/stores/scenes'
import { findPathToNode, treeState } from '../../../lib/stores/tree'
import { useAi } from '../../../lib/use-ai'
import { setLoadingStates } from '../store'

const getChapterContent = async (chapter: Node): Promise<string[]> => {
  if (!chapter.children?.length) return []

  const sceneContents = await Promise.all(
    chapter.children.map(async (scene) => {
      const sceneData = scenesState.scenes[scene.id]
      if (!sceneData?.paragraphs.length) return ''

      return sceneData.paragraphs
        .map((p) => (typeof p.text === 'string' ? p.text : contentSchemaToText(p.text)))
        .join('\n\n')
    }),
  )

  return sceneContents
}

type GenerationApproach = {
  name: string
  content: string
  timestamp: number
}

export const generateSceneContent = async (node: Node) => {
  if (!node.oneliner) return

  setLoadingStates({ [`${node.id}_content`]: true })
  try {
    const path = findPathToNode(node.id)
    if (!path) return

    const [bookNode, arcNode, chapterNode] = path
    const book = treeState.structure.find((b) => b.id === bookNode.id)
    const arc = book?.children?.find((a) => a.id === arcNode.id)
    const currentArcIndex = bookNode.children?.findIndex((c) => c.id === arcNode.id)
    const lastArcNode = currentArcIndex ? bookNode.children?.[currentArcIndex - 1] : undefined
    const lastArc = lastArcNode?.id ? arcsStore.arcs[lastArcNode.id] : undefined
    const chapters = arc?.children ?? []
    const currentChapterIndex = chapters.findIndex((c) => c.id === chapterNode.id)
    const currentSceneIndex = chapterNode.children?.findIndex((s) => s.id === node.id)
    const currentChapter = chapters[currentChapterIndex]
    // Get previous chapter's content
    const previousChapter = currentChapterIndex > 0 ? chapters[currentChapterIndex - 1] : null
    const previousChapterContent = previousChapter ? await getChapterContent(previousChapter) : null

    const previousPreviousChapter = currentChapterIndex > 1 ? chapters[currentChapterIndex - 2] : null
    const previousPreviousChapterContent = previousPreviousChapter
      ? await getChapterContent(previousPreviousChapter)
      : null

    // Get current chapter's scenes up to this point
    const currentChapterScenes = currentChapter.children ?? []

    const nextScene = currentSceneIndex ? currentChapterScenes?.[currentSceneIndex + 1] : undefined

    const previousScenesInChapter = await Promise.all(
      currentChapterScenes.slice(0, currentSceneIndex).map(async (scene) => {
        const sceneData = scenesState.scenes[scene.id]
        return sceneData?.paragraphs
          .map((p) => (typeof p.text === 'string' ? p.text : contentSchemaToText(p.text)))
          .join('\n\n')
      }),
    )

    // Get character information
    const scene = scenesState.scenes[node.id]

    // Build initial context
    const initialContext = [
      `Book: ${book?.oneliner}`,
      `Arc: ${arc?.oneliner}`,
      `Chapter: ${currentChapter?.oneliner}`,
      `Scene: ${node.oneliner}`,
      scene.locationId && locationsState.locations[scene.locationId]
        ? `Location: ${locationsState.locations[scene.locationId].description}`
        : undefined,
    ]
      .filter(Boolean)
      .join('\n')
    // Gather additional context
    const task = `Generate a scene where: ${node.oneliner}`
    const additionalContext = await gatherContext(task, initialContext, node.id)

    // Build up the context prompt
    const contextLines: string[] = []

    // Add arc and current chapter info
    if (currentChapter?.oneliner) {
      contextLines.push(`<chapter_summary>${currentChapter.oneliner}</chapter_summary>`)
    }

    // Add arc highlights if they exist
    if (lastArc?.highlights?.length) {
      contextLines.push('<arc_highlights>')
      for (const highlight of lastArc.highlights) {
        contextLines.push(`<highlight category="${highlight.category}">${highlight.text}</highlight>`)
      }
      contextLines.push('</arc_highlights>')
    }

    // Add gathered context
    if (additionalContext.characters.length) {
      contextLines.push('<relevant_characters>')
      for (const char of additionalContext.characters) {
        contextLines.push(`<character reason="${char.reason}">${char.content}</character>`)
      }
      contextLines.push('</relevant_characters>')
    }

    if (additionalContext.locations.length) {
      contextLines.push('<relevant_locations>')
      for (const loc of additionalContext.locations) {
        contextLines.push(`<location reason="${loc.reason}">${loc.content}</location>`)
      }
      contextLines.push('</relevant_locations>')
    }

    if (additionalContext.scenes.length) {
      contextLines.push('<relevant_scenes>')
      for (const scene of additionalContext.scenes) {
        contextLines.push(`<scene reason="${scene.reason}">${scene.content}</scene>`)
      }
      contextLines.push('</relevant_scenes>')
    }

    // Add second previous chapter if it exists
    if (previousPreviousChapter) {
      contextLines.push('<second_last_chapter>')
      for (const scene of previousPreviousChapterContent ?? []) {
        contextLines.push(`<scene_content>${scene}</scene_content>`)
      }
      contextLines.push('</second_last_chapter>')
    }

    // Add previous chapter if it exists
    if (previousChapter) {
      contextLines.push('<last_chapter>')
      for (const scene of previousChapterContent ?? []) {
        contextLines.push(`<scene_content>${scene}</scene_content>`)
      }
      contextLines.push('</last_chapter>')
    }

    const currentSceneLines: string[] = []

    currentSceneLines.push('<current_chapter>')
    for (const scene of previousScenesInChapter) {
      currentSceneLines.push(`<scene_content>${scene}</scene_content>`)
    }
    currentSceneLines.push('</current_chapter>')

    // Build up the characters and current scene info
    const characterLines: string[] = []
    if (scene.protagonistId) {
      const protagonist = charactersState.characters[scene.protagonistId]
      if (protagonist) {
        characterLines.push(
          `<perspective>${protagonist.firstName}'s ${scene.perspective ?? 'third'} person perspective - ${protagonist.summary}</perspective>`,
        )
      }
    }
    for (const charId of scene?.characterIds ?? []) {
      const char = charactersState.characters[charId]
      if (!char) continue
      const charText = `${[char.firstName, char.middleName, char.lastName].filter(Boolean).join(' ')}: ${char.summary}`
      characterLines.push(`<present_character>${charText}</present_character>`)
    }
    for (const charId of scene?.referredCharacterIds ?? []) {
      const char = charactersState.characters[charId]
      if (!char) continue
      const charText = `${[char.firstName, char.middleName, char.lastName].filter(Boolean).join(' ')}: ${char.summary}`
      characterLines.push(`<referred_character>${charText}</referred_character>`)
    }

    const locationLines: string[] = []
    if (scene?.locationId) {
      locationLines.push(
        `<current_location>${locationsState.locations[scene.locationId].description}</current_location>`,
      )
    }

    const prompt = [
      {
        text: [
          '<story_context>',
          contextLines.join('\n'),
          `<next_scene>${nextScene?.oneliner ?? 'Last scene in chapter'}</next_scene>`,
          '</story_context>',
        ].join('\n'),
        canCache: true,
      },
      {
        text: [
          '<scene_setup>',
          characterLines.join('\n'),
          currentSceneLines.join('\n'),
          locationLines.join('\n'),
          '</scene_setup>',
        ].join('\n'),
        canCache: true,
      },
      {
        text: ['<scene_to_write>', `<summary>${node.oneliner}</summary>`, '</scene_to_write>'].join('\n'),
        canCache: false,
      },
    ].filter((i) => i.text)

    // Track different generation approaches
    const approaches: GenerationApproach[] = []

    // Version 1: Basic generation
    console.log('Generating basic version...')
    const basicContent = await useAi('snowflake_generate_scene', prompt)
    // approaches.push({
    //   name: "Basic Generation",
    //   content: basicContent,
    //   timestamp: Date.now(),
    // });

    // Version 2: Enhanced prompt with built-in refinement guidance
    // console.log("Generating enhanced version...");
    // const enhancedContent = await useAi(
    //   "snowflake_generate_scene_enhanced",
    //   prompt,
    // );
    // approaches.push({
    //   name: "Enhanced Generation",
    //   content: enhancedContent,
    //   timestamp: Date.now(),
    // });

    // Version 3: Basic generation + critique + refinement
    console.log('Generating refined version...')
    const critique = await useAi('snowflake_critique_scene', [{ text: basicContent, canCache: true }])

    const refinedContent = await useAi('snowflake_refine_scene_style', [
      { text: basicContent, canCache: true },
      { text: critique, canCache: false },
    ])

    approaches.push({
      name: 'Refined Generation',
      content: refinedContent,
      timestamp: Date.now(),
    })

    // Store all versions in scene data
    updateSceneData(node.id, {
      generationApproaches: [...(scenesState.scenes[node.id]?.generationApproaches ?? []), ...approaches],
    })

    // Use the refined version as the default content
    const paragraphs = refinedContent.split('\n\n').filter((p: string) => p.trim())

    if (scenesState.scenes[node.id]?.paragraphs?.length === 0) {
      // Clear existing paragraphs
      updateSceneData(node.id, {
        paragraphs: [],
        words: 0,
      })

      for (const paragraph of paragraphs) {
        const paragraphId = shortUUID.generate()
        createSceneParagraph(node.id, {
          id: paragraphId,
          text: paragraph,
          state: 'ai',
          comments: [],
          plot_point_actions: [],
          modifiedAt: Date.now(),
        })
      }
      addNotification({
        type: 'success',
        title: 'Scene Content Generated',
        message: 'New content has been added to the scene.',
      })
    } else {
      addNotification({
        type: 'success',
        title: 'Variant Generated',
        message: 'New content has been added to variants.',
      })
    }
  } catch (error: unknown) {
    addNotification({
      type: 'error',
      title: 'Failed to generate scene content',
      message: error instanceof Error ? error.message : 'Unknown error occurred',
    })
  } finally {
    setLoadingStates({ [`${node.id}_content`]: false })
  }
}
