import { adventureStore } from '../../stores/adventureStore'
import { generateMessageId } from '../../utils/id'
import type {
  CharacterCard,
  PlotPoint,
  AgendaItem,
  Disposition,
} from '../../hooks/useAdventurePersistence'
import { DISPOSITIONS } from '../../hooks/useAdventurePersistence'

/**
 * Result of applying a single analysis tool call. The engine wraps this
 * with the timestamp and raw args to build an activity-log entry, so
 * every tool call (including no-ops and failures) becomes visible in the
 * UI for debugging.
 */
export interface ToolCallOutcome {
  status: 'applied' | 'noop'
  summary: string
}

/**
 * Apply a single tool call from the analysis pass to the world-state
 * store and return a structured outcome describing what happened.
 *
 * Throws on:
 *   - Unknown tool name
 *   - Missing/invalid required arguments
 *   - References to ids that don't exist in the store
 *
 * The caller (engine) catches and logs failures non-fatally — a malformed
 * tool call should not poison the rest of the analysis pass.
 */
export function applyAnalysisToolCall(
  name: string,
  args: unknown,
): ToolCallOutcome {
  const a = args as Record<string, unknown>
  if (a == null || typeof a !== 'object') {
    throw new Error('Tool call arguments must be an object')
  }

  switch (name) {
    case 'add_character':
      return applyAddCharacter(a)
    case 'patch_character':
      return applyPatchCharacter(a)
    case 'archive_character':
      return applyArchiveCharacter(a)
    case 'add_plot_point':
      return applyAddPlotPoint(a)
    case 'patch_plot_point':
      return applyPatchPlotPoint(a)
    case 'remove_plot_point':
      return applyRemovePlotPoint(a)
    case 'add_agenda_item':
      return applyAddAgendaItem(a)
    case 'patch_agenda_item':
      return applyPatchAgendaItem(a)
    case 'remove_agenda_item':
      return applyRemoveAgendaItem(a)
    case 'patch_protagonist':
      return applyPatchProtagonist(a)
    default:
      throw new Error(`Unknown tool: ${name}`)
  }
}

// --- Helpers ---

function requireString(args: Record<string, unknown>, key: string): string {
  const v = args[key]
  if (typeof v !== 'string' || v.trim().length === 0) {
    throw new Error(`Missing or empty string field: ${key}`)
  }
  return v.trim()
}

function optionalString(
  args: Record<string, unknown>,
  key: string,
): string | undefined {
  const v = args[key]
  if (v === undefined || v === null) return undefined
  if (typeof v !== 'string') {
    throw new Error(`Field ${key} must be a string when provided`)
  }
  return v
}

const applied = (summary: string): ToolCallOutcome => ({
  status: 'applied',
  summary,
})
const noop = (summary: string): ToolCallOutcome => ({
  status: 'noop',
  summary,
})

// --- Character ops ---

const DISPOSITION_SET = new Set<Disposition>(DISPOSITIONS)

function parseDisposition(v: unknown, field: string): Disposition {
  if (typeof v !== 'string' || !DISPOSITION_SET.has(v as Disposition)) {
    throw new Error(
      `Invalid ${field}: ${String(v)} (allowed: ${DISPOSITIONS.join(', ')})`,
    )
  }
  return v as Disposition
}

function applyAddCharacter(args: Record<string, unknown>): ToolCallOutcome {
  const card: CharacterCard = {
    id: generateMessageId(),
    name: requireString(args, 'name'),
    description: requireString(args, 'description'),
    motive: requireString(args, 'motive'),
    disposition: parseDisposition(args.disposition, 'disposition'),
  }
  adventureStore.upsertCharacter(card)
  return applied(`Added character: ${card.name} (${card.disposition})`)
}

function applyPatchCharacter(args: Record<string, unknown>): ToolCallOutcome {
  const id = requireString(args, 'id')
  const existing = adventureStore.characters[id]
  if (!existing) {
    throw new Error(`patch_character: unknown id "${id}"`)
  }

  const patch: Partial<Omit<CharacterCard, 'id'>> = {}
  // String-typed fields handled in a loop; disposition is enum-typed and
  // handled separately so we can validate it against the 7-step scale.
  const stringFields: Array<'name' | 'description' | 'motive'> = [
    'name',
    'description',
    'motive',
  ]
  const changed: string[] = []
  for (const field of stringFields) {
    const next = optionalString(args, field)
    if (next !== undefined && next !== existing[field]) {
      patch[field] = next
      changed.push(field)
    }
  }

  if (args.disposition !== undefined) {
    const nextDisposition = parseDisposition(args.disposition, 'disposition')
    if (nextDisposition !== existing.disposition) {
      patch.disposition = nextDisposition
      changed.push(`disposition→${nextDisposition}`)
    }
  }

  if (changed.length === 0) {
    return noop(`No changes to ${existing.name}`)
  }
  adventureStore.patchCharacter(id, patch)
  return applied(`Updated ${existing.name}: ${changed.join(', ')}`)
}

function applyArchiveCharacter(
  args: Record<string, unknown>,
): ToolCallOutcome {
  const id = requireString(args, 'id')
  const reason = requireString(args, 'reason')
  const existing = adventureStore.characters[id]
  if (!existing) {
    throw new Error(`archive_character: unknown id "${id}"`)
  }
  if (existing.archived) {
    return noop(`${existing.name} already archived`)
  }
  adventureStore.patchCharacter(id, { archived: true })
  return applied(`Archived ${existing.name}: ${reason}`)
}

// --- Plot point ops ---

/**
 * Statuses the analysis pass is allowed to set via add_/patch_plot_point.
 * `abandoned` is deliberately excluded — to drop a plot point the analysis
 * pass must call remove_plot_point, so dead plot points don't accumulate
 * in storage and the world panel. (The PlotPoint type still permits
 * `abandoned` for back-compat with manually-set entries.)
 */
const PLOT_STATUSES = new Set<PlotPoint['status']>([
  'seeded',
  'active',
  'resolving',
  'resolved',
])

function parsePlotStatus(v: unknown, field: string): PlotPoint['status'] {
  if (typeof v !== 'string' || !PLOT_STATUSES.has(v as PlotPoint['status'])) {
    throw new Error(
      `Invalid ${field}: ${String(v)} (allowed: ${Array.from(PLOT_STATUSES).join(', ')}; for abandonment use remove_plot_point)`,
    )
  }
  return v as PlotPoint['status']
}

function applyAddPlotPoint(args: Record<string, unknown>): ToolCallOutcome {
  const point: PlotPoint = {
    id: generateMessageId(),
    title: requireString(args, 'title'),
    description: requireString(args, 'description'),
    status: parsePlotStatus(args.status, 'status'),
  }
  adventureStore.upsertPlotPoint(point)
  return applied(`Seeded plot point: ${point.title} (${point.status})`)
}

function applyPatchPlotPoint(args: Record<string, unknown>): ToolCallOutcome {
  const id = requireString(args, 'id')
  const existing = adventureStore.plotPoints[id]
  if (!existing) {
    throw new Error(`patch_plot_point: unknown id "${id}"`)
  }

  const patch: Partial<Omit<PlotPoint, 'id'>> = {}
  const changed: string[] = []

  const nextTitle = optionalString(args, 'title')
  if (nextTitle !== undefined && nextTitle !== existing.title) {
    patch.title = nextTitle
    changed.push('title')
  }
  const nextDesc = optionalString(args, 'description')
  if (nextDesc !== undefined && nextDesc !== existing.description) {
    patch.description = nextDesc
    changed.push('description')
  }
  if (args.status !== undefined) {
    const nextStatus = parsePlotStatus(args.status, 'status')
    if (nextStatus !== existing.status) {
      patch.status = nextStatus
      changed.push(`status→${nextStatus}`)
    }
  }

  if (changed.length === 0) {
    return noop(`No changes to plot "${existing.title}"`)
  }
  adventureStore.patchPlotPoint(id, patch)
  return applied(`Updated plot "${existing.title}": ${changed.join(', ')}`)
}

function applyRemovePlotPoint(args: Record<string, unknown>): ToolCallOutcome {
  const id = requireString(args, 'id')
  const reason = requireString(args, 'reason')
  const existing = adventureStore.plotPoints[id]
  if (!existing) {
    throw new Error(`remove_plot_point: unknown id "${id}"`)
  }
  adventureStore.removePlotPoint(id)
  return applied(`Removed plot "${existing.title}": ${reason}`)
}

// --- Agenda ops ---

function applyAddAgendaItem(args: Record<string, unknown>): ToolCallOutcome {
  const item: AgendaItem = {
    id: generateMessageId(),
    description: requireString(args, 'description'),
    when: requireString(args, 'when'),
  }
  adventureStore.upsertAgendaItem(item)
  return applied(`Added agenda: ${item.description}`)
}

function applyPatchAgendaItem(args: Record<string, unknown>): ToolCallOutcome {
  const id = requireString(args, 'id')
  const existing = adventureStore.agenda.find((a) => a.id === id)
  if (!existing) {
    throw new Error(`patch_agenda_item: unknown id "${id}"`)
  }

  const patch: Partial<Omit<AgendaItem, 'id'>> = {}
  const changed: string[] = []
  const nextDesc = optionalString(args, 'description')
  if (nextDesc !== undefined && nextDesc !== existing.description) {
    patch.description = nextDesc
    changed.push('description')
  }
  const nextWhen = optionalString(args, 'when')
  if (nextWhen !== undefined && nextWhen !== existing.when) {
    patch.when = nextWhen
    changed.push('when')
  }
  if (changed.length === 0) {
    return noop(`No changes to agenda "${existing.description}"`)
  }
  adventureStore.patchAgendaItem(id, patch)
  return applied(
    `Updated agenda "${existing.description}": ${changed.join(', ')}`,
  )
}

function applyRemoveAgendaItem(
  args: Record<string, unknown>,
): ToolCallOutcome {
  const id = requireString(args, 'id')
  const reason = requireString(args, 'reason')
  const existing = adventureStore.agenda.find((a) => a.id === id)
  if (!existing) {
    throw new Error(`remove_agenda_item: unknown id "${id}"`)
  }
  adventureStore.removeAgendaItem(id)
  return applied(`Removed agenda "${existing.description}": ${reason}`)
}

// --- Protagonist op ---

function applyPatchProtagonist(
  args: Record<string, unknown>,
): ToolCallOutcome {
  const description = requireString(args, 'description')
  const reason = requireString(args, 'reason')
  const previous = adventureStore.protagonistInput.trim()
  if (description.trim() === previous) {
    return noop('Protagonist unchanged')
  }
  adventureStore.setProtagonistInput(description)
  return applied(`Updated protagonist: ${reason}`)
}
