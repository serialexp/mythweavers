import firstNamesRaw from './first.txt?raw'
import lastNamesRaw from './last.txt?raw'

// Parse names from text files (one name per line, trimmed)
const firstNames = firstNamesRaw
  .split('\n')
  .map((name) => name.trim())
  .filter((name) => name.length > 0)

const lastNames = lastNamesRaw
  .split('\n')
  .map((name) => name.trim())
  .filter((name) => name.length > 0)

/**
 * Fisher-Yates shuffle to get random elements from an array
 */
function getRandomElements<T>(array: T[], count: number): T[] {
  const result: T[] = []
  const used = new Set<number>()

  while (result.length < count && result.length < array.length) {
    const index = Math.floor(Math.random() * array.length)
    if (!used.has(index)) {
      used.add(index)
      result.push(array[index])
    }
  }

  return result
}

/**
 * Get a set of random first names
 */
export function getRandomFirstNames(count: number = 10): string[] {
  return getRandomElements(firstNames, count)
}

/**
 * Get a set of random last names
 */
export function getRandomLastNames(count: number = 10): string[] {
  return getRandomElements(lastNames, count)
}

/**
 * Generate random name suggestions context for LLM
 * Returns XML with random first and last names to choose from
 */
export function getRandomNamesContext(firstCount: number = 10, lastCount: number = 10): string {
  const randomFirstNames = getRandomFirstNames(firstCount)
  const randomLastNames = getRandomLastNames(lastCount)

  return `<name-suggestions>
  <first-names>${randomFirstNames.join(', ')}</first-names>
  <last-names>${randomLastNames.join(', ')}</last-names>
</name-suggestions>
`
}
