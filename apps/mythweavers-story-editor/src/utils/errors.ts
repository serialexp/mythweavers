/**
 * Thrown when story generation cannot proceed because previous scenes are missing summaries.
 * This is a recoverable error - the user can choose to proceed anyway.
 */
export class MissingSummariesError extends Error {
  public readonly missingNodeTitles: string[]

  constructor(missingNodeTitles: string[]) {
    const message = `Cannot generate story continuation. The following previous scenes need summaries first: ${missingNodeTitles.join(', ')}`
    super(message)
    this.name = 'MissingSummariesError'
    this.missingNodeTitles = missingNodeTitles
  }
}
