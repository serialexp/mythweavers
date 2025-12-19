import { diffSentences } from 'diff'
import type { Node } from 'prosemirror-model'
import { Plugin, PluginKey } from 'prosemirror-state'
import { Decoration, DecorationSet } from 'prosemirror-view'
import { getParagraphIdAtPos } from '../utils/paragraph-conversion'

export interface ParagraphSuggestion {
  paragraphId: string
  content: string
  isLoading?: boolean
}

const suggestionsPluginKey = new PluginKey('suggestions')

// Diff result interface
interface DiffPart {
  type: 'equal' | 'delete' | 'insert'
  text: string
}

function createWordDiff(originalText: string, suggestedText: string): DiffPart[] {
  // Try sentence-level diffing first
  const sentenceChanges = diffSentences(originalText, suggestedText)

  // If there are too many sentence changes, just show as complete replacement
  const changedSentences = sentenceChanges.filter((change) => change.added || change.removed).length
  const totalSentences = sentenceChanges.length

  if (changedSentences > totalSentences * 0.6) {
    // Too many changes - show as complete replacement
    return [
      { type: 'delete', text: originalText },
      { type: 'insert', text: suggestedText },
    ]
  }

  // Convert sentence changes to our format
  const sentenceDiff: DiffPart[] = sentenceChanges.map((change) => ({
    type: change.added ? 'insert' : change.removed ? 'delete' : 'equal',
    text: change.value,
  }))

  // For sentences that changed, do word-level diff within them
  const result: DiffPart[] = []

  for (const part of sentenceDiff) {
    if (part.type === 'equal') {
      result.push(part)
    } else {
      // For changed sentences, we already have them marked as insert/delete
      // Group consecutive changes
      result.push(part)
    }
  }

  return groupConsecutiveChanges(result)
}

function groupConsecutiveChanges(diff: DiffPart[]): DiffPart[] {
  const result: DiffPart[] = []
  let i = 0

  while (i < diff.length) {
    const current = diff[i]

    if (current.type === 'equal') {
      result.push(current)
      i++
      continue
    }

    // Collect consecutive changes (deletions and insertions)
    const changeGroup: DiffPart[] = []
    let j = i

    while (j < diff.length && diff[j].type !== 'equal') {
      changeGroup.push(diff[j])
      j++
    }

    // Group consecutive changes
    const deletions = changeGroup.filter((part) => part.type === 'delete')
    const insertions = changeGroup.filter((part) => part.type === 'insert')

    // Add grouped deletions first
    if (deletions.length > 0) {
      result.push({
        type: 'delete',
        text: deletions.map((d) => d.text).join(''),
      })
    }

    // Then grouped insertions
    if (insertions.length > 0) {
      result.push({
        type: 'insert',
        text: insertions.map((d) => d.text).join(''),
      })
    }

    i = j
  }

  return result
}

function createDiffHTML(diff: DiffPart[]): string {
  return diff
    .map((part) => {
      switch (part.type) {
        case 'equal':
          return `<span>${escapeHtml(part.text)}</span>`
        case 'delete':
          return `<span class="diff-delete">${escapeHtml(part.text)}</span>`
        case 'insert':
          return `<span class="diff-insert">${escapeHtml(part.text)}</span>`
        default:
          return escapeHtml(part.text)
      }
    })
    .join('')
}

function escapeHtml(text: string): string {
  const div = document.createElement('div')
  div.textContent = text
  return div.innerHTML
}

function createSuggestionWidget(
  suggestion: ParagraphSuggestion,
  originalText: string,
  onAccept: (paragraphId: string) => void,
  onReject: (paragraphId: string) => void,
): HTMLElement {
  const widget = document.createElement('div')
  widget.className = 'suggestion-widget'
  widget.style.cssText = `
    position: fixed;
    right: 20px;
    top: 50%;
    transform: translateY(-50%);
    width: 400px;
    background: white;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    padding: 12px;
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
    z-index: 1000;
    max-height: 80vh;
    overflow-y: auto;
  `

  // Only prevent events on the widget container itself, not its content
  widget.onmousedown = (e) => {
    // Only prevent if clicking on the widget background, not on content
    if (e.target === widget) {
      e.stopPropagation()
    }
  }

  if (suggestion.isLoading) {
    widget.innerHTML = `
      <div class="flex items-center space-x-2">
        <div class="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-900"></div>
        <span class="text-sm text-gray-600">Generating suggestion...</span>
      </div>
    `
  } else {
    const suggestionContainer = document.createElement('div')

    // Create diff view
    const diff = createWordDiff(originalText, suggestion.content)
    const diffHTML = createDiffHTML(diff)

    const header = document.createElement('div')
    header.style.cssText = `
      font-weight: 600;
      margin-bottom: 8px;
      font-size: 14px;
      color: #374151;
    `
    header.textContent = 'Suggested Changes'

    const legend = document.createElement('div')
    legend.style.cssText = `
      font-size: 11px;
      color: #6b7280;
      margin-bottom: 8px;
      display: flex;
      gap: 12px;
    `
    legend.innerHTML = `
      <span><span class="diff-delete-inline">■</span> Removed</span>
      <span><span class="diff-insert-inline">■</span> Added</span>
    `

    const content = document.createElement('div')
    content.className = 'suggestion-content'
    content.style.cssText = `
      background: #f9fafb;
      border-radius: 4px;
      padding: 12px;
      margin-bottom: 12px;
      font-family: inherit;
      font-size: 13px;
      line-height: 1.6;
      border: 1px solid #e5e7eb;
      max-height: 400px;
      overflow-y: auto;
      user-select: text;
      -webkit-user-select: text;
      -moz-user-select: text;
      -ms-user-select: text;
    `
    content.innerHTML = diffHTML

    // Allow text selection but prevent ProseMirror from handling selection events
    content.onmouseup = (e) => {
      e.stopPropagation()
    }

    content.onselectstart = (e) => {
      e.stopPropagation()
    }

    const buttons = document.createElement('div')
    buttons.className = 'suggestion-buttons'
    buttons.style.cssText = `
      display: flex;
      gap: 8px;
      justify-content: flex-end;
    `

    const copyButton = document.createElement('button')
    copyButton.textContent = 'Copy'
    copyButton.className = 'btn btn-sm btn-outline'
    copyButton.onclick = (e) => {
      e.preventDefault()
      e.stopPropagation()
      navigator.clipboard
        .writeText(suggestion.content)
        .then(() => {
          // Briefly show feedback
          const originalText = copyButton.textContent
          copyButton.textContent = 'Copied!'
          setTimeout(() => {
            copyButton.textContent = originalText
          }, 1000)
        })
        .catch((err) => {
          console.error('Failed to copy text: ', err)
          copyButton.textContent = 'Copy Failed'
          setTimeout(() => {
            copyButton.textContent = 'Copy'
          }, 1000)
        })
    }

    const acceptButton = document.createElement('button')
    acceptButton.textContent = 'Accept'
    acceptButton.className = 'btn btn-sm btn-success'
    acceptButton.onclick = (e) => {
      e.preventDefault()
      e.stopPropagation()
      onAccept(suggestion.paragraphId)
    }

    const rejectButton = document.createElement('button')
    rejectButton.textContent = 'Reject'
    rejectButton.className = 'btn btn-sm btn-error'
    rejectButton.onclick = (e) => {
      e.preventDefault()
      e.stopPropagation()
      onReject(suggestion.paragraphId)
    }

    buttons.appendChild(copyButton)
    buttons.appendChild(acceptButton)
    buttons.appendChild(rejectButton)

    suggestionContainer.appendChild(header)
    suggestionContainer.appendChild(legend)
    suggestionContainer.appendChild(content)
    suggestionContainer.appendChild(buttons)
    widget.appendChild(suggestionContainer)
  }

  return widget
}

function createDecorations(
  doc: Node,
  onAccept: (paragraphId: string) => void,
  onReject: (paragraphId: string) => void,
  currentParagraphId?: string,
): DecorationSet {
  const decorations: Decoration[] = []
  const paragraphsFound: any[] = []

  // Find paragraphs with suggestions by checking document attributes
  doc.descendants((node, pos) => {
    if (node.type.name === 'paragraph' && node.attrs.id) {
      const paragraphId = node.attrs.id
      const hasExtra = node.attrs.extra && node.attrs.extra.trim() !== ''
      const isLoading = node.attrs.extraLoading === 'true'

      paragraphsFound.push({
        id: paragraphId,
        hasExtra,
        isLoading,
        extra: node.attrs.extra,
        extraLoading: node.attrs.extraLoading,
        isCurrent: paragraphId === currentParagraphId,
      })

      if (hasExtra || isLoading) {
        // Only show suggestions for the currently selected paragraph or if it's loading
        if (isLoading || paragraphId === currentParagraphId) {
          console.log(
            `Showing suggestion for paragraph ${paragraphId} - current: ${currentParagraphId}, loading: ${isLoading}, extra: "${node.attrs.extra}"`,
          )

          const suggestion: ParagraphSuggestion = {
            paragraphId: paragraphId,
            content: node.attrs.extra || '',
            isLoading: isLoading,
          }

          // Get original text for diff comparison
          const originalText = node.textContent

          const widget = createSuggestionWidget(suggestion, originalText, onAccept, onReject)
          const decoration = Decoration.widget(pos + node.nodeSize, widget, {
            side: 1,
            key: `suggestion-${paragraphId}`,
          })
          decorations.push(decoration)
        }
      }
    }
  })

  console.log(
    `createDecorations: found ${paragraphsFound.length} paragraphs, ${decorations.length} decorations created. Current paragraph: ${currentParagraphId}`,
  )
  console.log(
    'Paragraph details:',
    paragraphsFound.filter((p) => p.hasExtra || p.isLoading || p.isCurrent),
  )

  return DecorationSet.create(doc, decorations)
}

export function createSuggestionsPlugin(
  onAccept: (paragraphId: string, content: string) => void,
  onReject: (paragraphId: string) => void,
) {
  return new Plugin({
    key: suggestionsPluginKey,

    state: {
      init() {
        return DecorationSet.empty
      },
      apply(_tr, _decorationSet, _oldState, newState) {
        // Get current paragraph ID directly from the selection in the new state
        const currentParagraphId = getParagraphIdAtPos(newState.doc, newState.selection.from)
        console.log('Suggestions plugin apply called, current paragraph from selection:', currentParagraphId)

        return createDecorations(
          newState.doc,
          (paragraphId) => {
            // Find the paragraph in the document to get its extra content
            let extraContent = ''
            newState.doc.descendants((node) => {
              if (node.type.name === 'paragraph' && node.attrs.id === paragraphId && node.attrs.extra) {
                extraContent = node.attrs.extra
                return false // Stop iteration
              }
            })
            if (extraContent) {
              onAccept(paragraphId, extraContent)
            }
          },
          onReject,
          currentParagraphId || undefined,
        )
      },
    },

    props: {
      decorations(state) {
        return this.getState(state)
      },
    },
  })
}

// Legacy command functions for compatibility - these are no longer needed
// but kept for backward compatibility in case they're used elsewhere
export const SuggestionsCommands = {
  addSuggestion: (_paragraphId: string, _content: string, _isLoading = false) => {
    return (_state: any, _dispatch: any) => {
      // This is now handled by the store, not the plugin
      console.warn('SuggestionsCommands.addSuggestion is deprecated - use updateSceneParagraphData instead')
      return true
    }
  },

  removeSuggestion: (_paragraphId: string) => {
    return (_state: any, _dispatch: any) => {
      // This is now handled by the store, not the plugin
      console.warn('SuggestionsCommands.removeSuggestion is deprecated - use updateSceneParagraphData instead')
      return true
    }
  },

  clearAllSuggestions: () => {
    return (_state: any, _dispatch: any) => {
      // This is now handled by the store, not the plugin
      console.warn('SuggestionsCommands.clearAllSuggestions is deprecated - use store actions instead')
      return true
    }
  },
}
