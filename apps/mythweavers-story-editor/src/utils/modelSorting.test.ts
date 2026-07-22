import { describe, expect, it } from 'vitest'
import type { Model } from '../types/core'
import type { ModelPricing } from '../types/llm'
import { sortModelsByPrice } from './modelSorting'

const model = (name: string, pricing?: ModelPricing): Model => ({
  name,
  size: 0,
  digest: '',
  modified_at: '',
  pricing,
})

// Prices per 1M tokens. Rank math for the fixture set:
//   input ranks:  free 0, m1 1, m2 2, deepseek 3, m3 4, no-cache 5
//   cached ranks: free 0, deepseek 1, m3 2, m1 3, m2 4, no-cache 5
//   scores:       free 0, m1 4, deepseek 4, m2 6, m3 6, no-cache 10
const free = model('free')
const m1 = model('m1', { input: 0.1, output: 0.2, input_cache_read: 0.5 })
const m2 = model('m2', { input: 0.2, output: 0.4, input_cache_read: 0.6 })
const deepseek = model('deepseek', { input: 0.55, output: 2.19, input_cache_read: 0.07 })
const m3 = model('m3', { input: 1.0, output: 2.0, input_cache_read: 0.4 })
const noCache = model('no-cache', { input: 2.0, output: 4.0 })

describe('sortModelsByPrice', () => {
  it('returns an empty array unchanged', () => {
    expect(sortModelsByPrice([])).toEqual([])
  })

  it('orders by merged input and cached-input rank', () => {
    const sorted = sortModelsByPrice([m2, deepseek, m3, m1, noCache, free])
    expect(sorted.map((m) => m.name)).toEqual(['free', 'm1', 'deepseek', 'm2', 'm3', 'no-cache'])
  })

  it('ranks near-free cached tokens above a cheaper input price with poor caching', () => {
    // m2 input (0.2) is cheaper than deepseek (0.55), but its cached tokens
    // cost 0.6 while deepseek's cost 0.07, so deepseek wins overall.
    const sorted = sortModelsByPrice([free, m1, m2, deepseek, m3, noCache])
    expect(sorted.indexOf(deepseek)).toBeLessThan(sorted.indexOf(m2))
  })

  it('treats missing cached pricing as full input price', () => {
    // no-cache input (2.0) is only slightly pricier than m3 (1.0), but m3's
    // cached tokens cost 0.4 vs 2.0, so m3 ranks well ahead.
    const sorted = sortModelsByPrice([noCache, m3])
    expect(sorted.map((m) => m.name)).toEqual(['m3', 'no-cache'])
  })

  it('breaks rank ties by input price', () => {
    // m1 and deepseek both score 4; m1 has the cheaper input price.
    const sorted = sortModelsByPrice([deepseek, m1])
    expect(sorted.map((m) => m.name)).toEqual(['m1', 'deepseek'])
  })

  it('breaks full ties by name', () => {
    const b = model('b-model', { input: 0.5, output: 1.0, input_cache_read: 0.1 })
    const a = model('a-model', { input: 0.5, output: 1.0, input_cache_read: 0.1 })
    const sorted = sortModelsByPrice([b, a])
    expect(sorted.map((m) => m.name)).toEqual(['a-model', 'b-model'])
  })

  it('does not mutate the input array', () => {
    const models = [m2, free, deepseek]
    sortModelsByPrice(models)
    expect(models.map((m) => m.name)).toEqual(['m2', 'free', 'deepseek'])
  })
})
