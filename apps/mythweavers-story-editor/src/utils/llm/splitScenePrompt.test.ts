import { describe, expect, it } from 'vitest'
import { createSplitScenePrompt } from './splitScenePrompt'

describe('createSplitScenePrompt', () => {
  it('instructs the AI to produce the author-requested chapter and total-scene counts', () => {
    const prompt = createSplitScenePrompt(
      [
        {
          messageId: 'message-1',
          messageNumber: 1,
          content: 'A short scene.',
          order: 0,
          wordCount: 3,
          paragraphs: ['A short scene.'],
        },
      ],
      {
        nodeId: 'scene-1',
        title: 'Opening',
        parentId: 'chapter-1',
        type: 'scene',
      },
      { chapterCount: 2, sceneCount: 6 },
    )

    expect(prompt).toContain('<target_chapters>2</target_chapters>')
    expect(prompt).toContain('<target_total_scenes>6</target_total_scenes>')
    expect(prompt).toContain('exactly 2 chapters and exactly 6 scenes total across all chapters')
    expect(prompt).toContain('Do not create extra scenes for individual paragraphs')
  })
})
