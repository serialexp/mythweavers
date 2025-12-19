/**
 * Commands module for solid-editor
 *
 * Exports all available commands that can be bound to keys or called programmatically.
 */

// Cursor movement commands
export {
  // Basic movement
  cursorLeft,
  cursorRight,
  cursorUp,
  cursorDown,
  cursorLineStart,
  cursorLineEnd,
  cursorDocStart,
  cursorDocEnd,
  cursorWordLeft,
  cursorWordRight,
  // Selection extension
  selectLeft,
  selectRight,
  selectUp,
  selectDown,
  selectLineStart,
  selectLineEnd,
  selectDocStart,
  selectDocEnd,
  selectWordLeft,
  selectWordRight,
  selectAll,
  // Goal column management
  resetGoalColumn,
} from './cursor'

// Editing commands (structural changes)
export {
  splitBlock,
  splitBlockKeepMarks,
  joinBackward,
  joinForward,
  deleteBackward,
  deleteForward,
} from './editing'

// Re-export Command type from cursor (renamed to avoid conflict with keymap)
export type { Command as CursorCommand } from './cursor'

import type { KeyBindings } from '../keymap'
import { redo, undo } from '../plugins/history'
/**
 * Base keymap with essential cursor movement commands.
 * Can be merged with custom keymaps.
 */
import {
  cursorDocEnd,
  cursorDocStart,
  cursorDown,
  cursorLeft,
  cursorLineEnd,
  cursorLineStart,
  cursorRight,
  cursorUp,
  cursorWordLeft,
  cursorWordRight,
  selectAll,
  selectDocEnd,
  selectDocStart,
  selectDown,
  selectLeft,
  selectLineEnd,
  selectLineStart,
  selectRight,
  selectUp,
  selectWordLeft,
  selectWordRight,
} from './cursor'
import { splitBlock } from './editing'

/**
 * Base keymap with cursor movement and selection commands.
 * This provides standard arrow key and selection behavior.
 */
export const baseKeymap: KeyBindings = {
  // Basic cursor movement
  ArrowLeft: cursorLeft,
  ArrowRight: cursorRight,
  ArrowUp: cursorUp,
  ArrowDown: cursorDown,

  // Line start/end (Home/End)
  Home: cursorLineStart,
  End: cursorLineEnd,

  // Document start/end (Cmd/Ctrl + Home/End)
  'Mod-Home': cursorDocStart,
  'Mod-End': cursorDocEnd,

  // Word movement (Alt/Option + Arrow)
  'Alt-ArrowLeft': cursorWordLeft,
  'Alt-ArrowRight': cursorWordRight,

  // Selection with Shift
  'Shift-ArrowLeft': selectLeft,
  'Shift-ArrowRight': selectRight,
  'Shift-ArrowUp': selectUp,
  'Shift-ArrowDown': selectDown,

  // Line selection
  'Shift-Home': selectLineStart,
  'Shift-End': selectLineEnd,

  // Document selection
  'Mod-Shift-Home': selectDocStart,
  'Mod-Shift-End': selectDocEnd,

  // Word selection
  'Alt-Shift-ArrowLeft': selectWordLeft,
  'Alt-Shift-ArrowRight': selectWordRight,

  // Select all
  'Mod-a': selectAll,

  // Block editing
  Enter: splitBlock,

  // History (undo/redo)
  'Mod-z': undo,
  'Mod-y': redo,
  'Mod-Shift-z': redo,
}

/**
 * Mac-specific keymap additions.
 * On Mac, Ctrl+A/E go to line start/end.
 */
export const macKeymap: KeyBindings = {
  ...baseKeymap,
  'Ctrl-a': cursorLineStart,
  'Ctrl-e': cursorLineEnd,
  'Ctrl-Shift-a': selectLineStart,
  'Ctrl-Shift-e': selectLineEnd,
}
