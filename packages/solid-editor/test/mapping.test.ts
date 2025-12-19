import { describe, expect, it } from 'vitest'
import { Mapping, StepMap } from '../src/transform'

function testMapping(mapping: Mapping, ...cases: [number, number, number?, boolean?][]) {
  const inverted = mapping.invert()
  for (const [from, to, bias = 1, lossy] of cases) {
    expect(mapping.map(from, bias)).toBe(to)
    if (!lossy) expect(inverted.map(to, bias)).toBe(from)
  }
}

function testDel(mapping: Mapping, pos: number, side: number, flags: string) {
  const r = mapping.mapResult(pos, side)
  let found = ''
  if (r.deleted) found += 'd'
  if (r.deletedBefore) found += 'b'
  if (r.deletedAfter) found += 'a'
  if (r.deletedAcross) found += 'x'
  expect(found).toBe(flags)
}

function mk(...args: (number[] | { [from: number]: number })[]) {
  const mapping = new Mapping()
  args.forEach((arg) => {
    if (Array.isArray(arg)) mapping.appendMap(new StepMap(arg))
    else for (const from in arg) mapping.setMirror(+from, arg[from])
  })
  return mapping
}

describe('Mapping', () => {
  it('can map through a single insertion', () => {
    testMapping(mk([2, 0, 4]), [0, 0], [2, 6], [2, 2, -1], [3, 7])
  })

  it('can map through a single deletion', () => {
    testMapping(mk([2, 4, 0]), [0, 0], [2, 2, -1], [3, 2, 1, true], [6, 2, 1], [6, 2, -1, true], [7, 3])
  })

  it('can map through a single replace', () => {
    testMapping(mk([2, 4, 4]), [0, 0], [2, 2, 1], [4, 6, 1, true], [4, 2, -1, true], [6, 6, -1], [8, 8])
  })

  it('can map through a mirrored delete-insert', () => {
    testMapping(mk([2, 4, 0], [2, 0, 4], { 0: 1 }), [0, 0], [2, 2], [4, 4], [6, 6], [7, 7])
  })

  it('can map through a mirrored insert-delete', () => {
    testMapping(mk([2, 0, 4], [2, 4, 0], { 0: 1 }), [0, 0], [2, 2], [3, 3])
  })

  it('can map through a delete-insert with an insert in between', () => {
    testMapping(mk([2, 4, 0], [1, 0, 1], [3, 0, 4], { 0: 2 }), [0, 0], [1, 2], [4, 5], [6, 7], [7, 8])
  })

  it('assigns the correct deleted flags when deletions happen before', () => {
    testDel(mk([0, 2, 0]), 2, -1, 'db')
    testDel(mk([0, 2, 0]), 2, 1, 'b')
    testDel(mk([0, 2, 2]), 2, -1, 'db')
    testDel(mk([0, 1, 0], [0, 1, 0]), 2, -1, 'db')
    testDel(mk([0, 1, 0]), 2, -1, '')
  })

  it('assigns the correct deleted flags when deletions happen after', () => {
    testDel(mk([2, 2, 0]), 2, -1, 'a')
    testDel(mk([2, 2, 0]), 2, 1, 'da')
    testDel(mk([2, 2, 2]), 2, 1, 'da')
    testDel(mk([2, 1, 0], [2, 1, 0]), 2, 1, 'da')
    testDel(mk([3, 2, 0]), 2, -1, '')
  })

  it('assigns the correct deleted flags when deletions happen across', () => {
    testDel(mk([0, 4, 0]), 2, -1, 'dbax')
    testDel(mk([0, 4, 0]), 2, 1, 'dbax')
    testDel(mk([0, 4, 0]), 2, 1, 'dbax')
    testDel(mk([0, 1, 0], [4, 1, 0], [0, 3, 0]), 2, 1, 'dbax')
  })

  it('assigns the correct deleted flags when deletions happen around', () => {
    testDel(mk([4, 1, 0], [0, 1, 0]), 2, -1, '')
    testDel(mk([2, 1, 0], [0, 2, 0]), 2, -1, 'dba')
    testDel(mk([2, 1, 0], [0, 1, 0]), 2, -1, 'a')
    testDel(mk([3, 1, 0], [0, 2, 0]), 2, -1, 'db')
  })
})
