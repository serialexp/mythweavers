import { describe, expect, it } from 'vitest'
import type { Character } from '../types/core'
import { resolveViewpointCharacter } from './character'

const character = (id: string, firstName: string, isMainCharacter = false): Character => ({
  id,
  firstName,
  isMainCharacter,
})

const kaela = character('c1', 'Kaela', true)
const tomas = character('c2', 'Tomas')
const cast = [kaela, tomas]

describe('resolveViewpointCharacter', () => {
  it('returns the named character when the scene sets one', () => {
    expect(resolveViewpointCharacter('c2', cast)).toEqual({
      character: tomas,
      isExplicit: true,
      isDangling: false,
    })
  })

  it('falls back to the protagonist when the scene sets none', () => {
    for (const unset of [undefined, null, '']) {
      expect(resolveViewpointCharacter(unset, cast)).toEqual({
        character: kaela,
        isExplicit: false,
        isDangling: false,
      })
    }
  })

  it('reports a dangling viewpoint rather than falling back to the protagonist', () => {
    // A deleted character must not silently read as "the protagonist's scene".
    expect(resolveViewpointCharacter('gone', cast)).toEqual({
      character: undefined,
      isExplicit: true,
      isDangling: true,
    })
  })

  it('resolves to nobody when the story has no protagonist and no viewpoint is set', () => {
    expect(resolveViewpointCharacter(undefined, [tomas])).toEqual({
      character: undefined,
      isExplicit: false,
      isDangling: false,
    })
  })

  it('picks the first protagonist when several are flagged', () => {
    const second = character('c3', 'Wren', true)
    expect(resolveViewpointCharacter(undefined, [kaela, second]).character).toBe(kaela)
  })

  it('resolves against an empty cast without throwing', () => {
    expect(resolveViewpointCharacter(undefined, [])).toEqual({
      character: undefined,
      isExplicit: false,
      isDangling: false,
    })
    expect(resolveViewpointCharacter('c1', [])).toEqual({
      character: undefined,
      isExplicit: true,
      isDangling: true,
    })
  })
})
