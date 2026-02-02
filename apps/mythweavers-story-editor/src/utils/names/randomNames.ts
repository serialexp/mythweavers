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
 * Get a set of random full names (first + last combinations)
 */
export function getRandomFullNames(count: number = 10): string[] {
  const randomFirstNames = getRandomElements(firstNames, count)
  const randomLastNames = getRandomElements(lastNames, count)

  return randomFirstNames.map((first, i) => `${first} ${randomLastNames[i]}`)
}

/**
 * Generate random name suggestions context for LLM
 * Returns XML with random full name combinations to choose from
 */
export function getRandomNamesContext(count: number = 10): string {
  const fullNames = getRandomFullNames(count)

  return `<name-suggestions>${fullNames.join(', ')}</name-suggestions>
`
}
