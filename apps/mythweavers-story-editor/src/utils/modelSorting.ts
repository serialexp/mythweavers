import type { Model } from '../types/core'

const inputCost = (model: Model): number => model.pricing?.input ?? 0

// Models without cached-read pricing get no caching discount: a cached
// token effectively costs the same as a regular input token.
const cachedInputCost = (model: Model): number => model.pricing?.input_cache_read ?? inputCost(model)

/**
 * Competition ranking: a model's rank is the number of models with a
 * strictly lower cost, so equal costs share the same rank.
 */
function ranksByCost(models: Model[], cost: (model: Model) => number): number[] {
  const costs = models.map(cost)
  return costs.map((c) => costs.filter((other) => other < c).length)
}

/**
 * Sort models by a merged ranking of normal input price and cached input
 * price (Borda count). Each model is ranked independently on both prices,
 * and the ranks are summed; lower is better. This surfaces models that are
 * attractive in either dimension — e.g. DeepSeek is pricey per input token
 * but cached tokens are nearly free, so it still outranks models that are
 * cheaper on input but offer no caching discount.
 */
export function sortModelsByPrice(models: Model[]): Model[] {
  const inputRanks = ranksByCost(models, inputCost)
  const cachedRanks = ranksByCost(models, cachedInputCost)

  return models
    .map((model, index) => ({ model, score: inputRanks[index] + cachedRanks[index] }))
    .sort((a, b) => {
      if (a.score !== b.score) return a.score - b.score
      const inputDiff = inputCost(a.model) - inputCost(b.model)
      if (inputDiff !== 0) return inputDiff
      return a.model.name.localeCompare(b.model.name)
    })
    .map(({ model }) => model)
}
