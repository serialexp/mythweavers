import { Alert, Badge, Button, Card, CardBody, Input, Modal, Spinner, Stack } from '@mythweavers/ui'
import { For, Show, createSignal } from 'solid-js'
import { messagesStore } from '../stores/messagesStore'
import { nodeStore } from '../stores/nodeStore'
import { ReplacePreview, SearchResult, SearchSnippet, searchModalStore } from '../stores/searchModalStore'
import { Message } from '../types/core'
import * as styles from './SearchModal.css'

interface MessageWithContext extends Message {
  chapterName: string
  messageIndex: number
}

export function SearchModal() {
  const [isSearching, setIsSearching] = createSignal(false)

  // Search logic
  const performSearch = (searchTerm: string, replaceTerm?: string) => {
    if (!searchTerm.trim()) {
      searchModalStore.setSearchResults([])
      return
    }

    // Disable multi-word search when replace mode is active
    if (replaceTerm && searchTerm.includes(' ')) {
      searchModalStore.setSearchResults([])
      return
    }

    setIsSearching(true)

    // Get all messages with chapter context
    const messagesWithContext: MessageWithContext[] = messagesStore.messages
      .filter((msg) => msg.role === 'assistant' && !msg.isQuery)
      .map((msg) => {
        // Find the chapter/node this message belongs to
        const node = nodeStore.getNode(msg.sceneId || '')
        const chapterName = node?.title || 'Unknown Chapter'

        // Calculate message index within its chapter
        const chapterMessages = messagesStore.messages
          .filter(
            (m) => (m.sceneId === msg.sceneId) && m.role === 'assistant' && !m.isQuery,
          )
          .sort((a, b) => a.order - b.order)
        const messageIndex = chapterMessages.findIndex((m) => m.id === msg.id) + 1

        return {
          ...msg,
          chapterName,
          messageIndex,
        }
      })

    // Split search term into individual words (only for non-replace mode)
    // For replace mode, use exact case-sensitive search
    const baseTerms = replaceTerm
      ? [searchTerm]
      : searchTerm
          .toLowerCase()
          .trim()
          .split(/\s+/)
          .filter((term) => term.length > 0)

    const searchTerms = replaceTerm
      ? baseTerms // Keep original case for replace mode
      : Array.from(new Set(baseTerms))

    const isReplaceMode = replaceTerm !== undefined && replaceTerm.length > 0
    const requireAllTerms = searchModalStore.requireAllTerms && searchTerms.length > 1

    const results: SearchResult[] = []

    for (const message of messagesWithContext) {
      const snippets: SearchSnippet[] = []
      const matchingTerms = new Set<string>()

      // Search in content
      if (searchModalStore.searchInContent && message.content) {
        const contentSnippets = findSnippetsInText(message.content, searchTerms, 'content', isReplaceMode)
        snippets.push(...contentSnippets)
        contentSnippets.forEach((snippet) => {
          // Count which terms matched in this snippet
          searchTerms.forEach((term) => {
            const textToCheck = isReplaceMode ? snippet.text : snippet.text.toLowerCase()
            const termToCheck = isReplaceMode ? term : term.toLowerCase()
            if (textToCheck.includes(termToCheck)) {
              matchingTerms.add(term)
            }
          })
        })
      }

      // Search in instruction
      if (searchModalStore.searchInInstruction && message.instruction) {
        const instructionSnippets = findSnippetsInText(message.instruction, searchTerms, 'instruction', isReplaceMode)
        snippets.push(...instructionSnippets)
        instructionSnippets.forEach((snippet) => {
          searchTerms.forEach((term) => {
            const textToCheck = isReplaceMode ? snippet.text : snippet.text.toLowerCase()
            const termToCheck = isReplaceMode ? term : term.toLowerCase()
            if (textToCheck.includes(termToCheck)) {
              matchingTerms.add(term)
            }
          })
        })
      }

      // Search in think section (only if enabled)
      if (searchModalStore.searchInThink && message.think) {
        const thinkSnippets = findSnippetsInText(message.think, searchTerms, 'think', isReplaceMode)
        snippets.push(...thinkSnippets)
        thinkSnippets.forEach((snippet) => {
          searchTerms.forEach((term) => {
            const textToCheck = isReplaceMode ? snippet.text : snippet.text.toLowerCase()
            const termToCheck = isReplaceMode ? term : term.toLowerCase()
            if (textToCheck.includes(termToCheck)) {
              matchingTerms.add(term)
            }
          })
        })
      }

      // If we found matches, add to results
      const matchedTermCount = matchingTerms.size
      const passesTermRequirement = !requireAllTerms || matchedTermCount === searchTerms.length

      if (snippets.length > 0 && passesTermRequirement) {
        // Generate replace previews if in replace mode
        let replacements: ReplacePreview[] | undefined
        if (replaceTerm !== undefined && replaceTerm.length > 0) {
          replacements = generateReplacePreviews(message, searchTerm, replaceTerm)
        }

        results.push({
          messageId: message.id,
          chapterName: message.chapterName,
          messageIndex: message.messageIndex,
          snippets,
          matchCount: matchedTermCount,
          replacements,
        })
      }
    }

    // Sort results by match count (descending) and then by chapter order
    results.sort((a, b) => {
      if (a.matchCount !== b.matchCount) {
        return b.matchCount - a.matchCount
      }
      // Secondary sort by chapter name and message index
      if (a.chapterName !== b.chapterName) {
        return a.chapterName.localeCompare(b.chapterName)
      }
      return a.messageIndex - b.messageIndex
    })

    searchModalStore.setSearchResults(results)
    setIsSearching(false)
  }

  // Generate replace previews for a message
  const generateReplacePreviews = (
    message: MessageWithContext,
    searchText: string,
    replaceText: string,
  ): ReplacePreview[] => {
    const previews: ReplacePreview[] = []

    if (searchModalStore.searchInContent && message.content && message.content.includes(searchText)) {
      let index = 0
      while ((index = message.content.indexOf(searchText, index)) !== -1) {
        const contextStart = Math.max(0, index - 50)
        const contextEnd = Math.min(message.content.length, index + searchText.length + 50)
        const context = message.content.slice(contextStart, contextEnd)

        previews.push({
          section: 'content',
          originalText: searchText,
          replacementText: replaceText,
          context: (contextStart > 0 ? '...' : '') + context + (contextEnd < message.content.length ? '...' : ''),
          contextStart: index - contextStart + (contextStart > 0 ? 3 : 0),
        })
        index += searchText.length
      }
    }

    if (searchModalStore.searchInInstruction && message.instruction && message.instruction.includes(searchText)) {
      let index = 0
      while ((index = message.instruction.indexOf(searchText, index)) !== -1) {
        const contextStart = Math.max(0, index - 50)
        const contextEnd = Math.min(message.instruction.length, index + searchText.length + 50)
        const context = message.instruction.slice(contextStart, contextEnd)

        previews.push({
          section: 'instruction',
          originalText: searchText,
          replacementText: replaceText,
          context: (contextStart > 0 ? '...' : '') + context + (contextEnd < message.instruction.length ? '...' : ''),
          contextStart: index - contextStart + (contextStart > 0 ? 3 : 0),
        })
        index += searchText.length
      }
    }

    if (searchModalStore.searchInThink && message.think && message.think.includes(searchText)) {
      let index = 0
      while ((index = message.think.indexOf(searchText, index)) !== -1) {
        const contextStart = Math.max(0, index - 50)
        const contextEnd = Math.min(message.think.length, index + searchText.length + 50)
        const context = message.think.slice(contextStart, contextEnd)

        previews.push({
          section: 'think',
          originalText: searchText,
          replacementText: replaceText,
          context: (contextStart > 0 ? '...' : '') + context + (contextEnd < message.think.length ? '...' : ''),
          contextStart: index - contextStart + (contextStart > 0 ? 3 : 0),
        })
        index += searchText.length
      }
    }

    return previews
  }

  // Extract snippets with context around matches
  const findSnippetsInText = (
    text: string,
    searchTerms: string[],
    section: 'content' | 'instruction' | 'think',
    caseSensitive = false,
  ): SearchSnippet[] => {
    const snippets: SearchSnippet[] = []
    const searchText = caseSensitive ? text : text.toLowerCase()
    const processedRanges: Array<{ start: number; end: number }> = []

    for (const term of searchTerms) {
      const searchTerm = caseSensitive ? term : term.toLowerCase()
      let index = 0
      while ((index = searchText.indexOf(searchTerm, index)) !== -1) {
        // Check if this match overlaps with existing snippets
        const snippetStart = Math.max(0, index - 100)
        const snippetEnd = Math.min(text.length, index + searchTerm.length + 100)

        // Check for overlap with existing ranges
        const overlaps = processedRanges.some(
          (range) =>
            (snippetStart >= range.start && snippetStart <= range.end) ||
            (snippetEnd >= range.start && snippetEnd <= range.end) ||
            (snippetStart <= range.start && snippetEnd >= range.end),
        )

        if (!overlaps) {
          const snippetText = text.slice(snippetStart, snippetEnd)
          const matchStartInSnippet = index - snippetStart

          snippets.push({
            text: (snippetStart > 0 ? '...' : '') + snippetText + (snippetEnd < text.length ? '...' : ''),
            section,
            matchStart: matchStartInSnippet + (snippetStart > 0 ? 3 : 0), // Account for '...'
            matchLength: searchTerm.length,
          })

          processedRanges.push({ start: snippetStart, end: snippetEnd })
        }

        index += searchTerm.length
      }
    }

    return snippets
  }

  // Handle Enter key press to trigger search
  const handleKeyPress = (e: KeyboardEvent) => {
    if (e.key === 'Enter') {
      performSearch(searchModalStore.searchTerm, searchModalStore.replaceTerm || undefined)
    }
  }

  // Handle replace action
  const handleReplace = (messageId: string, section: 'content' | 'instruction' | 'think') => {
    const replaced = messagesStore.replaceInMessage(
      messageId,
      searchModalStore.searchTerm,
      searchModalStore.replaceTerm,
      [section],
    )
    if (replaced) {
      searchModalStore.markAsReplaced(messageId, section)
      // Re-run search to update results
      performSearch(searchModalStore.searchTerm, searchModalStore.replaceTerm)
    }
  }

  // Handle replace all for a message
  const handleReplaceAllInMessage = (result: SearchResult) => {
    if (!result.replacements) return

    const sections = [...new Set(result.replacements.map((r) => r.section))]
    const count = messagesStore.replaceAllInMessage(
      result.messageId,
      searchModalStore.searchTerm,
      searchModalStore.replaceTerm,
      sections,
    )
    if (count > 0) {
      sections.forEach((section) => searchModalStore.markAsReplaced(result.messageId, section))
      // Re-run search to update results
      performSearch(searchModalStore.searchTerm, searchModalStore.replaceTerm)
    }
  }

  // Handle replace all globally
  const handleReplaceAll = async () => {
    const totalReplacements = searchModalStore.searchResults.reduce(
      (sum, result) => sum + (result.replacements?.length || 0),
      0,
    )
    const totalMessages = searchModalStore.searchResults.length

    // Show confirmation for large operations
    if (totalReplacements > 10) {
      if (!confirm(`Are you sure you want to replace ${totalReplacements} occurrences in ${totalMessages} messages?`)) {
        return
      }
    }

    // Perform all replacements
    for (const result of searchModalStore.searchResults) {
      if (result.replacements && result.replacements.length > 0) {
        const sections = [...new Set(result.replacements.map((r) => r.section))]
        messagesStore.replaceAllInMessage(
          result.messageId,
          searchModalStore.searchTerm,
          searchModalStore.replaceTerm,
          sections,
        )
        sections.forEach((section) => searchModalStore.markAsReplaced(result.messageId, section))
      }
    }

    // Re-run search to update results
    performSearch(searchModalStore.searchTerm, searchModalStore.replaceTerm)
  }

  // Handle result click - navigate to message
  const handleResultClick = (result: SearchResult) => {
    const message = messagesStore.messages.find((m) => m.id === result.messageId)
    if (!message) return

    const nodeId = message.sceneId
    if (nodeId) {
      // Select the chapter/node
      nodeStore.selectNode(nodeId)

      // Close the modal
      searchModalStore.hide()

      // Scroll to the message after a brief delay to allow DOM update
      setTimeout(() => {
        const messageElement = document.querySelector(`[data-message-id="${result.messageId}"]`)
        if (messageElement) {
          messageElement.scrollIntoView({
            behavior: 'smooth',
            block: 'center',
          })
        }
      }, 100)
    }
  }

  // Render replace preview with diff visualization
  const renderReplacePreview = (preview: ReplacePreview) => {
    const before = preview.context.substring(0, preview.contextStart)
    const after = preview.context.substring(preview.contextStart + preview.originalText.length)

    return (
      <div class={styles.replacePreviewText}>
        <span>{before}</span>
        <span class={styles.deleteHighlight}>
          {preview.originalText}
        </span>
        <span class={styles.insertHighlight}>
          {preview.replacementText}
        </span>
        <span>{after}</span>
      </div>
    )
  }

  // Check if a section has been replaced for a message
  const isSectionReplaced = (messageId: string, section: 'content' | 'instruction' | 'think') => {
    const status = searchModalStore.completedReplacements.find((r) => r.messageId === messageId)
    return status?.sectionsReplaced.includes(section) || false
  }

  // Render snippet with highlighted matches
  const renderSnippet = (snippet: SearchSnippet, searchTerms: string[]) => {
    const text = snippet.text
    let lastIndex = 0
    const parts: Array<{ text: string; isHighlight: boolean }> = []

    // Find all matches in this snippet
    const matches: Array<{ start: number; end: number }> = []
    const lowerText = text.toLowerCase()

    for (const term of searchTerms) {
      let index = 0
      while ((index = lowerText.indexOf(term, index)) !== -1) {
        matches.push({ start: index, end: index + term.length })
        index += term.length
      }
    }

    // Sort matches by position and merge overlapping ones
    matches.sort((a, b) => a.start - b.start)
    const mergedMatches: Array<{ start: number; end: number }> = []

    for (const match of matches) {
      if (mergedMatches.length === 0) {
        mergedMatches.push(match)
      } else {
        const lastMatch = mergedMatches[mergedMatches.length - 1]
        if (match.start <= lastMatch.end) {
          // Overlapping, merge
          lastMatch.end = Math.max(lastMatch.end, match.end)
        } else {
          mergedMatches.push(match)
        }
      }
    }

    // Build parts array
    for (const match of mergedMatches) {
      // Add text before match
      if (lastIndex < match.start) {
        parts.push({ text: text.slice(lastIndex, match.start), isHighlight: false })
      }
      // Add highlighted match
      parts.push({ text: text.slice(match.start, match.end), isHighlight: true })
      lastIndex = match.end
    }

    // Add remaining text
    if (lastIndex < text.length) {
      parts.push({ text: text.slice(lastIndex), isHighlight: false })
    }

    return (
      <span style={{ display: 'inline' }}>
        <For each={parts}>
          {(part) => (
            <Show when={part.isHighlight} fallback={<span>{part.text}</span>}>
              <mark class={styles.searchHighlight}>
                {part.text}
              </mark>
            </Show>
          )}
        </For>
      </span>
    )
  }

  const getSectionLabel = (section: string) => {
    switch (section) {
      case 'content':
        return 'Content'
      case 'instruction':
        return 'Instruction'
      case 'think':
        return 'Think'
      default:
        return section
    }
  }

  const searchTokens = () =>
    Array.from(
      new Set(
        searchModalStore.searchTerm
          .toLowerCase()
          .trim()
          .split(/\s+/)
          .filter((term: string) => term.length > 0),
      ),
    )

  // Get displayed results (limited or all)
  const displayedResults = () => {
    const results = searchModalStore.searchResults
    if (searchModalStore.showAllResults || results.length <= 20) {
      return results
    }
    return results.slice(0, 20)
  }

  const hasMoreResults = () => {
    return !searchModalStore.showAllResults && searchModalStore.searchResults.length > 20
  }

  return (
    <Modal
      open={searchModalStore.isOpen}
      onClose={() => searchModalStore.hide()}
      title={searchModalStore.isReplaceMode ? 'Search and Replace' : 'Search Messages'}
      size="lg"
    >
      <Stack gap="md" style={{ 'margin-bottom': '16px' }}>
        <Input
          type="text"
          value={searchModalStore.searchTerm}
          onInput={(e) => searchModalStore.setSearchTerm(e.currentTarget.value)}
          onKeyPress={handleKeyPress}
          placeholder="Search for... (Press Enter to search)"
          autofocus
          disabled={!!searchModalStore.replaceTerm && searchModalStore.searchTerm.includes(' ')}
        />

        <Input
          type="text"
          value={searchModalStore.replaceTerm}
          onInput={(e) => {
            searchModalStore.setReplaceTerm(e.currentTarget.value)
            // Generate replacement previews for existing results
            if (e.currentTarget.value && searchModalStore.searchResults.length > 0) {
              const updatedResults = searchModalStore.searchResults.map((result) => {
                const message = messagesStore.messages.find((m) => m.id === result.messageId)
                if (message) {
                  const messageWithContext = {
                    ...message,
                    chapterName: result.chapterName,
                    messageIndex: result.messageIndex,
                  }
                  return {
                    ...result,
                    replacements: generateReplacePreviews(
                      messageWithContext,
                      searchModalStore.searchTerm,
                      e.currentTarget.value,
                    ),
                  }
                }
                return result
              })
              searchModalStore.setSearchResults(updatedResults)
            } else if (!e.currentTarget.value) {
              // Clear replacements when replace term is removed
              const updatedResults = searchModalStore.searchResults.map((result) => ({
                ...result,
                replacements: undefined,
              }))
              searchModalStore.setSearchResults(updatedResults)
            }
          }}
          onKeyPress={handleKeyPress}
          placeholder="Replace with... (optional)"
          disabled={searchModalStore.searchTerm.includes(' ') && searchModalStore.searchTerm.trim().length > 0}
        />

        <Button
          onClick={() => performSearch(searchModalStore.searchTerm, searchModalStore.replaceTerm || undefined)}
          variant="primary"
          disabled={!searchModalStore.searchTerm.trim()}
        >
          Search
        </Button>

        <Show when={searchModalStore.searchTerm.includes(' ') && searchModalStore.replaceTerm}>
          <Alert variant="warning">Multi-word search is disabled in replace mode. Use single words only.</Alert>
        </Show>

        <div class={styles.optionsRow}>
          <label class={styles.checkboxLabel}>
            <input
              type="checkbox"
              checked={searchModalStore.searchInContent}
              onChange={(e) => searchModalStore.setSearchInContent(e.currentTarget.checked)}
              style={{ cursor: 'pointer' }}
            />
            Content
          </label>
          <label class={styles.checkboxLabel}>
            <input
              type="checkbox"
              checked={searchModalStore.searchInInstruction}
              onChange={(e) => searchModalStore.setSearchInInstruction(e.currentTarget.checked)}
              style={{ cursor: 'pointer' }}
            />
            Instructions
          </label>
          <label class={styles.checkboxLabel}>
            <input
              type="checkbox"
              checked={searchModalStore.searchInThink}
              onChange={(e) => searchModalStore.setSearchInThink(e.currentTarget.checked)}
              style={{ cursor: 'pointer' }}
            />
            Think sections
          </label>
          <label class={searchTokens().length <= 1 ? styles.checkboxLabelDisabled : styles.checkboxLabel}>
            <input
              type="checkbox"
              checked={searchTokens().length > 1 && searchModalStore.requireAllTerms}
              onChange={(e) => searchModalStore.setRequireAllTerms(e.currentTarget.checked)}
              style={{ cursor: searchTokens().length <= 1 ? 'not-allowed' : 'pointer' }}
              disabled={searchTokens().length <= 1}
            />
            Match all terms
          </label>
        </div>
      </Stack>

      <Show when={isSearching()}>
        <Card variant="flat" style={{ 'margin-bottom': '16px' }}>
          <CardBody style={{ 'text-align': 'center' }}>
            <Spinner size="sm" /> Searching...
          </CardBody>
        </Card>
      </Show>

      <div class={styles.resultsHeader}>
        <span>
          {searchModalStore.showAllResults || searchModalStore.searchResults.length <= 20
            ? `${searchModalStore.searchResults.length} results`
            : `Showing 20 of ${searchModalStore.searchResults.length} results`}
          {searchModalStore.searchTerm && ` for "${searchModalStore.searchTerm}"`}
        </span>
      </div>

      <div class={styles.resultsContainer}>
        <For each={displayedResults()}>
          {(result) => (
            <Card interactive onClick={() => handleResultClick(result)} style={{ cursor: 'pointer' }}>
              <CardBody padding="sm">
                <div class={styles.resultHeader}>
                  <span class={styles.resultTitle}>
                    {result.chapterName} • Message {result.messageIndex}
                  </span>
                  <Badge variant="secondary" size="sm">
                    {result.matchCount} term{result.matchCount !== 1 ? 's' : ''} matched
                  </Badge>
                </div>

                <Show
                  when={searchModalStore.isReplaceMode && result.replacements}
                  fallback={
                    <Stack gap="xs">
                      <For each={result.snippets}>
                        {(snippet) => (
                          <div class={styles.snippetContainer}>
                            <div class={styles.sectionLabel}>
                              {getSectionLabel(snippet.section)}:
                            </div>
                            <div class={styles.snippetText}>
                              {renderSnippet(snippet, searchTokens())}
                            </div>
                          </div>
                        )}
                      </For>
                    </Stack>
                  }
                >
                  <Stack gap="sm">
                    <For each={result.replacements}>
                      {(preview) => (
                        <div class={styles.replacePreviewContainer}>
                          <div class={styles.sectionLabel}>
                            {getSectionLabel(preview.section)}:
                          </div>
                          {renderReplacePreview(preview)}
                          <Show when={!isSectionReplaced(result.messageId, preview.section)}>
                            <div class={styles.buttonRow}>
                              <Button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleReplace(result.messageId, preview.section)
                                }}
                                variant="primary"
                                size="sm"
                              >
                                Replace
                              </Button>
                            </div>
                          </Show>
                          <Show when={isSectionReplaced(result.messageId, preview.section)}>
                            <Badge variant="success" size="sm">
                              ✓ Replaced
                            </Badge>
                          </Show>
                        </div>
                      )}
                    </For>
                    <Show
                      when={
                        result.replacements &&
                        result.replacements.length > 1 &&
                        !result.replacements.every((r) => isSectionReplaced(result.messageId, r.section))
                      }
                    >
                      <div class={styles.replaceAllDivider}>
                        <Button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleReplaceAllInMessage(result)
                          }}
                          variant="primary"
                          size="sm"
                        >
                          Replace All in This Message (
                          {result.replacements?.filter((r) => !isSectionReplaced(result.messageId, r.section)).length ||
                            0}
                          )
                        </Button>
                      </div>
                    </Show>
                  </Stack>
                </Show>
              </CardBody>
            </Card>
          )}
        </For>
      </div>

      <Show when={hasMoreResults()}>
        <div class={styles.showMoreRow}>
          <Button onClick={() => searchModalStore.setShowAllResults(true)} variant="secondary">
            Show All {searchModalStore.searchResults.length} Results
          </Button>
        </div>
      </Show>

      <div class={styles.footerActions}>
        <Show
          when={
            searchModalStore.isReplaceMode &&
            searchModalStore.searchResults.some(
              (r) =>
                r.replacements &&
                r.replacements.length > 0 &&
                !r.replacements.every((rp) => isSectionReplaced(r.messageId, rp.section)),
            )
          }
        >
          <Button onClick={handleReplaceAll} variant="danger">
            Replace All (
            {searchModalStore.searchResults.reduce(
              (sum, r) =>
                sum + (r.replacements?.filter((rp) => !isSectionReplaced(r.messageId, rp.section)).length || 0),
              0,
            )}{' '}
            occurrences)
          </Button>
        </Show>
        <Button onClick={() => searchModalStore.clearSearch()} variant="secondary">
          Clear Search
        </Button>
        <Button onClick={() => searchModalStore.hide()} variant="primary">
          Close
        </Button>
      </div>
    </Modal>
  )
}
