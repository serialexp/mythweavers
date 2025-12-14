import { createSignal } from 'solid-js'

export interface SearchResult {
  messageId: string
  chapterName: string
  messageIndex: number
  snippets: SearchSnippet[]
  matchCount: number // Number of search terms that matched
  replacements?: ReplacePreview[] // Preview of replacements when in replace mode
}

export interface SearchSnippet {
  text: string // 200 chars around the match
  section: 'content' | 'instruction' | 'think' // Which section matched
  matchStart: number // Position of match within the snippet
  matchLength: number // Length of the matched text
}

export interface ReplacePreview {
  section: 'content' | 'instruction' | 'think'
  originalText: string // The exact text that will be replaced
  replacementText: string // What it will be replaced with
  context: string // Some context around the replacement
  contextStart: number // Where the match starts in the context
}

export interface ReplacementStatus {
  messageId: string
  sectionsReplaced: Array<'content' | 'instruction' | 'think'>
}

const [isOpen, setIsOpen] = createSignal(false)
const [searchTerm, setSearchTerm] = createSignal('')
const [replaceTerm, setReplaceTerm] = createSignal('')
const [searchResults, setSearchResults] = createSignal<SearchResult[]>([])
const [showAllResults, setShowAllResults] = createSignal(false)
const [searchThinkSections, setSearchThinkSections] = createSignal(false)
// New state for section selection
const [searchInContent, setSearchInContent] = createSignal(true)
const [searchInInstruction, setSearchInInstruction] = createSignal(true)
const [searchInThink, setSearchInThink] = createSignal(false)
// Track which replacements have been completed
const [completedReplacements, setCompletedReplacements] = createSignal<ReplacementStatus[]>([])
const [requireAllTermsState, setRequireAllTermsState] = createSignal(false)

export const searchModalStore = {
  get isOpen() {
    return isOpen()
  },

  get searchTerm() {
    return searchTerm()
  },

  get replaceTerm() {
    return replaceTerm()
  },

  get searchResults() {
    return searchResults()
  },

  get showAllResults() {
    return showAllResults()
  },

  get searchThinkSections() {
    return searchThinkSections()
  },

  get searchInContent() {
    return searchInContent()
  },

  get searchInInstruction() {
    return searchInInstruction()
  },

  get searchInThink() {
    return searchInThink()
  },

  get completedReplacements() {
    return completedReplacements()
  },

  get requireAllTerms() {
    return requireAllTermsState()
  },

  get isReplaceMode() {
    return replaceTerm().length > 0
  },

  show() {
    setIsOpen(true)
  },

  hide() {
    setIsOpen(false)
    // Keep search term and results for when modal is reopened
  },

  setSearchTerm(term: string) {
    setSearchTerm(term)
    // Reset show all results when search term changes
    setShowAllResults(false)
    // Clear completed replacements when search changes
    setCompletedReplacements([])
  },

  setReplaceTerm(term: string) {
    setReplaceTerm(term)
    // Clear completed replacements when replace term changes
    setCompletedReplacements([])
  },

  setSearchResults(results: SearchResult[]) {
    setSearchResults(results)
  },

  setShowAllResults(show: boolean) {
    setShowAllResults(show)
  },

  setSearchThinkSections(search: boolean) {
    setSearchThinkSections(search)
    // Also update the individual checkbox
    setSearchInThink(search)
  },

  setSearchInContent(search: boolean) {
    setSearchInContent(search)
  },

  setSearchInInstruction(search: boolean) {
    setSearchInInstruction(search)
  },

  setSearchInThink(search: boolean) {
    setSearchInThink(search)
    // Keep backward compatibility with old searchThinkSections
    setSearchThinkSections(search)
  },

  setRequireAllTerms(requireAll: boolean) {
    setRequireAllTermsState(requireAll)
  },

  markAsReplaced(messageId: string, section: 'content' | 'instruction' | 'think') {
    setCompletedReplacements((prev) => {
      const existing = prev.find((r) => r.messageId === messageId)
      if (existing) {
        return prev.map((r) =>
          r.messageId === messageId
            ? { ...r, sectionsReplaced: [...r.sectionsReplaced, section] }
            : r
        )
      } else {
        return [...prev, { messageId, sectionsReplaced: [section] }]
      }
    })
  },

  clearSearch() {
    setSearchTerm('')
    setReplaceTerm('')
    setSearchResults([])
    setShowAllResults(false)
    setCompletedReplacements([])
    setRequireAllTermsState(false)
    // Keep section preferences - they should persist
  }
}
