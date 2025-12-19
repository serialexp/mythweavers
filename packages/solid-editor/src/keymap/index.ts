/**
 * Keymap module for solid-editor
 *
 * Compatible with ProseMirror's keymap API:
 * - Same command signature: (state, dispatch?, view?) => boolean
 * - Same key binding format: "Mod-z", "Ctrl-Shift-a", etc.
 * - Platform-aware "Mod" modifier (Cmd on Mac, Ctrl elsewhere)
 */

import type { EditorState, Transaction } from '../state'

/**
 * Minimal view context passed to commands.
 * This is a simplified version of the full EditorView for use in keymaps.
 */
export interface CommandContext {
  state: EditorState
  dispatch: (tr: Transaction) => void
  dom: HTMLElement | null
  focus: () => void
}

/**
 * A command function that can be bound to a key.
 *
 * Commands receive:
 * - state: The current editor state
 * - dispatch: Optional function to dispatch a transaction (if not provided, command should just check if it can run)
 * - view: Optional reference to the view context
 *
 * Returns true if the command was executed/applicable, false otherwise.
 */
export type Command = (state: EditorState, dispatch?: (tr: Transaction) => void, view?: CommandContext) => boolean

/**
 * Key bindings map - maps key names to commands
 */
export type KeyBindings = {
  [key: string]: Command
}

// Platform detection
const mac = typeof navigator !== 'undefined' && /Mac|iP(hone|[oa]d)/.test(navigator.platform)
const windows = typeof navigator !== 'undefined' && /Win/.test(navigator.platform)

/**
 * Normalize a key name to a canonical form.
 *
 * Accepts various formats:
 * - "Mod-z" (platform-aware: Cmd on Mac, Ctrl elsewhere)
 * - "Ctrl-Shift-a"
 * - "Meta-s", "Cmd-s", "m-s"
 * - "Alt-a", "a-a"
 * - "Space" or " "
 */
function normalizeKeyName(name: string): string {
  const parts = name.split(/-(?!$)/)
  let result = parts[parts.length - 1]

  // Handle "Space" special case
  if (result === 'Space') result = ' '

  let alt = false
  let ctrl = false
  let shift = false
  let meta = false

  for (let i = 0; i < parts.length - 1; i++) {
    const mod = parts[i]
    if (/^(cmd|meta|m)$/i.test(mod)) meta = true
    else if (/^a(lt)?$/i.test(mod)) alt = true
    else if (/^(c|ctrl|control)$/i.test(mod)) ctrl = true
    else if (/^s(hift)?$/i.test(mod)) shift = true
    else if (/^mod$/i.test(mod)) {
      if (mac) meta = true
      else ctrl = true
    } else {
      throw new RangeError(`Unrecognized modifier name: ${mod}`)
    }
  }

  // Build normalized name in consistent order: Alt-Ctrl-Meta-Shift-Key
  if (alt) result = `Alt-${result}`
  if (ctrl) result = `Ctrl-${result}`
  if (meta) result = `Meta-${result}`
  if (shift) result = `Shift-${result}`

  return result
}

/**
 * Normalize all bindings in a map
 */
function normalizeBindings(bindings: KeyBindings): KeyBindings {
  const normalized: KeyBindings = Object.create(null)

  for (const key in bindings) {
    const normalizedKey = normalizeKeyName(key)
    if (normalized[normalizedKey]) {
      throw new RangeError(`Duplicate key binding: ${key}`)
    }
    normalized[normalizedKey] = bindings[key]
  }

  return normalized
}

/**
 * Build a key string from an event with modifiers
 */
function modifiers(name: string, event: KeyboardEvent, includeShift = true): string {
  if (event.altKey) name = `Alt-${name}`
  if (event.ctrlKey) name = `Ctrl-${name}`
  if (event.metaKey) name = `Meta-${name}`
  if (includeShift && event.shiftKey) name = `Shift-${name}`
  return name
}

/**
 * Get the key name from a keyboard event
 */
function getKeyName(event: KeyboardEvent): string {
  // Use event.key which gives us the actual character/key name
  const key = event.key

  // Normalize some common keys
  if (key === ' ') return ' '
  if (key === 'Escape') return 'Escape'
  if (key === 'Enter') return 'Enter'
  if (key === 'Tab') return 'Tab'
  if (key === 'Backspace') return 'Backspace'
  if (key === 'Delete') return 'Delete'
  if (key === 'ArrowUp') return 'ArrowUp'
  if (key === 'ArrowDown') return 'ArrowDown'
  if (key === 'ArrowLeft') return 'ArrowLeft'
  if (key === 'ArrowRight') return 'ArrowRight'
  if (key === 'Home') return 'Home'
  if (key === 'End') return 'End'
  if (key === 'PageUp') return 'PageUp'
  if (key === 'PageDown') return 'PageDown'

  // For single characters, return lowercase for letters
  if (key.length === 1) {
    return key.toLowerCase()
  }

  return key
}

/**
 * Base key names by keyCode (for fallback matching)
 * Maps keyCodes to their unmodified US keyboard layout names
 */
const baseKeyByCode: { [keyCode: number]: string } = {
  8: 'Backspace',
  9: 'Tab',
  13: 'Enter',
  27: 'Escape',
  32: ' ',
  33: 'PageUp',
  34: 'PageDown',
  35: 'End',
  36: 'Home',
  37: 'ArrowLeft',
  38: 'ArrowUp',
  39: 'ArrowRight',
  40: 'ArrowDown',
  46: 'Delete',
  // Letters A-Z (keyCodes 65-90)
  65: 'a',
  66: 'b',
  67: 'c',
  68: 'd',
  69: 'e',
  70: 'f',
  71: 'g',
  72: 'h',
  73: 'i',
  74: 'j',
  75: 'k',
  76: 'l',
  77: 'm',
  78: 'n',
  79: 'o',
  80: 'p',
  81: 'q',
  82: 'r',
  83: 's',
  84: 't',
  85: 'u',
  86: 'v',
  87: 'w',
  88: 'x',
  89: 'y',
  90: 'z',
  // Numbers 0-9 (keyCodes 48-57)
  48: '0',
  49: '1',
  50: '2',
  51: '3',
  52: '4',
  53: '5',
  54: '6',
  55: '7',
  56: '8',
  57: '9',
  // Punctuation
  186: ';',
  187: '=',
  188: ',',
  189: '-',
  190: '.',
  191: '/',
  192: '`',
  219: '[',
  220: '\\',
  221: ']',
  222: "'",
}

/**
 * Create a keydown handler from a bindings map.
 *
 * The handler tries to match keys in this order:
 * 1. Direct match with all modifiers
 * 2. For character keys, try without shift (handles shift-modified chars like %)
 * 3. KeyCode fallback for non-ASCII keyboards
 */
export function keydownHandler(
  bindings: KeyBindings,
  getContext: () => CommandContext | null,
): (event: KeyboardEvent) => boolean {
  const map = normalizeBindings(bindings)

  return function handleKeyDown(event: KeyboardEvent): boolean {
    const context = getContext()
    if (!context) return false

    const { state, dispatch } = context
    const name = getKeyName(event)

    // 1. Try direct match
    const direct = map[modifiers(name, event)]
    if (direct?.(state, dispatch, context)) {
      return true
    }

    // 2. For single character keys (not space), try without shift
    if (name.length === 1 && name !== ' ' && event.shiftKey) {
      const noShift = map[modifiers(name, event, false)]
      if (noShift?.(state, dispatch, context)) {
        return true
      }
    }

    // 3. KeyCode fallback when modifiers are active
    // (but not Windows AltGr which is Ctrl+Alt)
    if ((event.altKey || event.metaKey || event.ctrlKey) && !(windows && event.ctrlKey && event.altKey)) {
      const baseName = baseKeyByCode[event.keyCode]
      if (baseName && baseName !== name) {
        const fromCode = map[modifiers(baseName, event)]
        if (fromCode?.(state, dispatch, context)) {
          return true
        }
      }
    }

    return false
  }
}

/**
 * Create a keymap that can be used with solid-editor.
 *
 * Returns an object with the handler and bindings that can be integrated
 * into the editor view.
 *
 * @example
 * ```ts
 * const myKeymap = keymap({
 *   "Mod-z": undo,
 *   "Mod-y": redo,
 *   "Mod-b": toggleBold,
 *   "Enter": splitParagraph,
 * })
 *
 * // Use with EditorView
 * <EditorView
 *   keymap={myKeymap}
 *   ...
 * />
 * ```
 */
export function keymap(bindings: KeyBindings): {
  bindings: KeyBindings
  createHandler: (getContext: () => CommandContext | null) => (event: KeyboardEvent) => boolean
} {
  return {
    bindings,
    createHandler: (getContext) => keydownHandler(bindings, getContext),
  }
}

// Re-export types
export type { EditorState, Transaction }
