import { describe, expect, it } from 'vitest'
import { validateProposedStructureTargets, validateSplitTargets } from './sceneSplitUtils'

describe('validateSplitTargets', () => {
  it('accepts a positive whole-number chapter and total-scene count', () => {
    expect(validateSplitTargets({ chapterCount: 2, sceneCount: 6 })).toEqual({ valid: true })
  })

  it.each([
    [{ chapterCount: 0, sceneCount: 1 }, 'Target chapters must be a whole number of at least 1'],
    [{ chapterCount: 1.5, sceneCount: 2 }, 'Target chapters must be a whole number of at least 1'],
    [{ chapterCount: 1, sceneCount: 0 }, 'Total scenes must be a whole number of at least 1'],
    [{ chapterCount: 3, sceneCount: 2 }, 'Total scenes must be at least the target chapter count'],
  ])('rejects invalid targets %#', (targets, error) => {
    expect(validateSplitTargets(targets)).toEqual({ valid: false, error })
  })
})

describe('validateProposedStructureTargets', () => {
  const proposal = {
    structure: [
      {
        type: 'chapter' as const,
        title: 'Chapter 1',
        scenes: [
          { title: 'Scene 1', messageAssignments: [] },
          { title: 'Scene 2', messageAssignments: [] },
        ],
      },
      {
        type: 'chapter' as const,
        title: 'Chapter 2',
        scenes: [
          { title: 'Scene 3', messageAssignments: [] },
          { title: 'Scene 4', messageAssignments: [] },
        ],
      },
    ],
  }

  it('accepts a proposal with exact requested counts', () => {
    expect(validateProposedStructureTargets(proposal, { chapterCount: 2, sceneCount: 4 })).toEqual({
      valid: true,
    })
  })

  it('rejects a proposal whose totals differ from the requested split', () => {
    expect(validateProposedStructureTargets(proposal, { chapterCount: 2, sceneCount: 5 })).toEqual({
      valid: false,
      error: 'AI proposed 2 chapters and 4 scenes, but you requested 2 chapters and 5 total scenes',
    })
  })
})
