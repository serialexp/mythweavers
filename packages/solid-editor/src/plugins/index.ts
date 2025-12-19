/**
 * Plugins for solid-editor
 */

export {
  history,
  historyKey,
  undo,
  redo,
  undoNoScroll,
  redoNoScroll,
  undoDepth,
  redoDepth,
  closeHistory,
  isHistoryTransaction,
  type HistoryOptions,
} from './history'

export {
  inputRules,
  inputRulesKey,
  textRule,
  smartQuotes,
  emDash,
  ellipsis,
  smartTypography,
  type InputRule,
} from './inputRules'
