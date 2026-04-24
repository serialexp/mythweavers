/**
 * Plugins for solidjs-editor
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
  // Markdown-style structural rules
  blockTypeRule,
  wrapRule,
  nodeRule,
  headingRule,
  horizontalRuleRule,
  codeBlockRule,
  blockquoteRule,
  // List rules
  bulletListRule,
  orderedListRule,
  type InputRule,
} from './inputRules'

export { richClipboard } from './clipboard'
