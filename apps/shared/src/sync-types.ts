import z from 'zod'

export const entityTypeSchema = z.enum(['Book', 'Arc', 'Chapter', 'Scene', 'Paragraph'])

export type EntityType = z.infer<typeof entityTypeSchema>

export interface Difference {
  id: string
  type: EntityType
  localTimestamp?: number
  serverTimestamp?: number
}

export interface DifferenceResult {
  lastUpdate: number
  localNew: Difference[]
  serverNew: Difference[]
  modifiedLocal: Difference[]
  modifiedServer: Difference[]
  inSync: Difference[]
}
