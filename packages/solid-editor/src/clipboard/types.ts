/**
 * Filter for restricting which node types and marks the clipboard
 * plugin serializes and parses.
 *
 * When a field is omitted or undefined, all types of that category
 * are allowed. When set to an array, only the listed type names are
 * handled — everything else is stripped.
 */
export interface ClipboardFilter {
  /** Allowed node type names (e.g. ['paragraph', 'heading']). */
  nodes?: string[]
  /** Allowed mark type names (e.g. ['strong', 'em']). */
  marks?: string[]
}
