import { Component, Show, For, createSignal, createMemo, onMount, onCleanup, createEffect } from 'solid-js'
import { Message as MessageType } from '../types/core'
import { BsX, BsChevronDown, BsChevronUp, BsPencil, BsCheck, BsRewindBtnFill, BsLightbulb, BsArrowRepeat, BsInfoCircle, BsCodeSlash, BsClockHistory, BsArrowDownCircle } from 'solid-icons/bs'
import { messagesStore } from '../stores/messagesStore'
import { modelsStore } from '../stores/modelsStore'
import { scriptDataStore } from '../stores/scriptDataStore'
import { uiStore } from '../stores/uiStore'
import type { SummaryViewMode } from '../stores/uiStore'
import { nodeStore } from '../stores/nodeStore'
import { viewModeStore } from '../stores/viewModeStore'
import { rewriteDialogStore } from '../stores/rewriteDialogStore'
import { MessageRegenerateButton } from './MessageRegenerateButton'
import { MessageActionsDropdown } from './MessageActionsDropdown'
import { MessageScriptModal } from './MessageScriptModal'
import { ScriptDataDiff } from './ScriptDataDiff'
import { MessageVersionHistory } from './MessageVersionHistory'
import { BranchMessage } from './BranchMessage'
import { useStoryGeneration } from '../hooks/useStoryGeneration'
import { useOllama } from '../hooks/useOllama'
import { SceneEditorWrapper } from './SceneEditorWrapper'
import { paragraphsToText } from '@story/shared'
import styles from './Message.module.css'
import { getTokenUsage } from '../utils/tokenUtils'
import { processPastedText } from '../utils/textProcessing'
import { saveService } from '../services/saveService'

interface MessageProps {
  message: MessageType
  storyTurnNumber: number
  totalStoryTurns: number
  isGenerating: boolean
}

export const Message: Component<MessageProps> = (props) => {
  // Get hooks for generation functions
  const { generateResponse, generateSummaries } = useOllama()
  const {
    handleRegenerateFromMessage,
    handleRegenerateQuery,
    handleSummarizeMessage,
    handleAnalyzeMessage
  } = useStoryGeneration({
    generateResponse,
    generateSummaries
  })
  const [isEditing, setIsEditing] = createSignal(false)
  const [editContent, setEditContent] = createSignal('')
  const [editParagraphs, setEditParagraphs] = createSignal<any[]>([])  // Track edited paragraphs from SceneEditor
  const [isEditingInstruction, setIsEditingInstruction] = createSignal(false)
  const [editInstruction, setEditInstruction] = createSignal('')
  const [showAnalysisDebug, setShowAnalysisDebug] = createSignal(false)
  const [showScriptModal, setShowScriptModal] = createSignal(false)
  const [hasUnsavedChanges, setHasUnsavedChanges] = createSignal(false)
  const [showVersionHistory, setShowVersionHistory] = createSignal(false)
  // Use stored value from message, or default to false
  const [isInstructionExpanded, setIsInstructionExpanded] = createSignal(props.message.isInstructionExpanded ?? false)
  
  // Update local state when prop changes
  createEffect(() => {
    setIsInstructionExpanded(props.message.isInstructionExpanded ?? false)
  })
  
  let messageRef: HTMLDivElement | undefined
  let autoSaveTimer: number | undefined
  
  // Helper function to extract plain text from contenteditable properly
  const getPlainTextFromContentEditable = (element: HTMLDivElement): string => {
    // Clone the element to avoid modifying the original
    const clone = element.cloneNode(true) as HTMLDivElement;
    
    // Replace <br> tags with newlines
    const brs = clone.querySelectorAll('br');
    brs.forEach(br => br.replaceWith('\n'));
    
    // Replace block elements (div, p) with their content + newline
    const blocks = clone.querySelectorAll('div, p');
    blocks.forEach(block => {
      const text = block.textContent || '';
      if (text) {
        block.replaceWith(text + '\n');
      }
    });
    
    // Get the text content and clean it up
    let text = clone.textContent || '';
    
    // Remove trailing newline if it exists (contenteditable often adds one)
    text = text.replace(/\n$/, '');
    
    return text;
  }
  
  // Create a unique key for this message's draft in localStorage
  const getDraftKey = () => `message-draft-${props.message.id}`
  
  // Save draft to localStorage
  const saveDraft = (content: string) => {
    if (content && content !== props.message.instruction) {
      localStorage.setItem(getDraftKey(), JSON.stringify({
        content,
        timestamp: Date.now(),
        originalContent: props.message.instruction
      }))
      setHasUnsavedChanges(true)
    }
  }
  
  // Clear draft from localStorage
  const clearDraft = () => {
    localStorage.removeItem(getDraftKey())
    setHasUnsavedChanges(false)
  }
  
  // Load draft on mount
  onMount(() => {
    const draftData = localStorage.getItem(getDraftKey())
    if (draftData) {
      try {
        const draft = JSON.parse(draftData)
        // Check if draft is less than 24 hours old
        if (Date.now() - draft.timestamp < 24 * 60 * 60 * 1000) {
          // If the original content matches, we can restore the draft
          if (draft.originalContent === props.message.instruction) {
            setHasUnsavedChanges(true)
            // Don't auto-enter edit mode, but show indicator
          }
        } else {
          // Clear old drafts
          clearDraft()
        }
      } catch (e) {
        console.error('Failed to load draft:', e)
        clearDraft()
      }
    }
  })
  
  // Clean up on unmount
  onCleanup(() => {
    if (autoSaveTimer) {
      clearTimeout(autoSaveTimer)
    }
  })

  
  // Calculate cost for this message
  const messageCost = createMemo(() => {
    if (!props.message.model) return null
    
    const model = modelsStore.availableModels.find(m => m.name === props.message.model)
    if (!model?.pricing) return null

    // Get standardized token usage
    const tokenUsage = getTokenUsage(props.message)
    if (!tokenUsage) return null

    // Parse prices based on provider format
    let promptPrice = 0
    let completionPrice = 0
    let cacheReadPrice = 0
    let cacheWritePrice = 0
    
    // All prices are now stored as numbers per million tokens
    promptPrice = model.pricing.input / 1_000_000
    completionPrice = model.pricing.output / 1_000_000
    cacheReadPrice = (model.pricing.input_cache_read || 0) / 1_000_000
    cacheWritePrice = (model.pricing.input_cache_write || 0) / 1_000_000

    // Calculate costs in dollars (all prices now converted to per-token)
    const promptCost = tokenUsage.input_normal * promptPrice
    const completionCost = tokenUsage.output_normal * completionPrice
    const cacheReadCost = tokenUsage.input_cache_read * cacheReadPrice
    const cacheWriteCost = tokenUsage.input_cache_write * cacheWritePrice
    const totalCost = promptCost + completionCost + cacheReadCost + cacheWriteCost

    // Calculate cache savings
    const cacheReadSavings = tokenUsage.input_cache_read > 0 ? tokenUsage.input_cache_read * (promptPrice - cacheReadPrice) : 0

    return {
      promptCost,
      completionCost,
      cacheReadCost,
      cacheWriteCost,
      totalCost,
      cacheReadSavings,
      promptPrice,
      completionPrice,
      cacheReadPrice,
      cacheWritePrice,
      tokenUsage
    }
  })
  
  const shouldShowSummary = () => {
    const hasAnySummary =
      !!(props.message.sentenceSummary ||
        props.message.summary ||
        props.message.paragraphSummary)
    return (
      hasAnySummary &&
      props.message.role === 'assistant' &&
      !props.message.isQuery
    )
  }

  const isExpanded = () => props.message.isExpanded ?? false

  type SummaryChoice = 'sentence' | 'paragraph' | 'full' | 'content'
  type SummaryLevel = Exclude<SummaryChoice, 'content'>

  const summaryView = createMemo(() => uiStore.summaryView)

  const summarySelection = createMemo(() => {
    const preference = summaryView()
    const available: Record<SummaryChoice, string | undefined> = {
      sentence: props.message.sentenceSummary,
      paragraph: props.message.paragraphSummary,
      full: props.message.summary,
      content: props.message.content
    }

    const pickFromOrder = (order: SummaryChoice[]) => {
      for (const key of order) {
        const value = available[key]
        if (value && value.trim().length > 0) {
          return { key, text: value }
        }
      }
      return { key: 'content' as SummaryChoice, text: available.content || '' }
    }

    if (preference === 'sentence') {
      return pickFromOrder(['sentence', 'paragraph', 'full', 'content'])
    }

    if (preference === 'paragraph') {
      return pickFromOrder(['paragraph', 'full', 'sentence', 'content'])
    }

    if (preference === 'full') {
      return pickFromOrder(['full', 'paragraph', 'sentence', 'content'])
    }

    if (viewModeStore.isScriptMode() && !isExpanded()) {
      return pickFromOrder(['paragraph', 'full', 'sentence', 'content'])
    }

    if (props.storyTurnNumber <= props.totalStoryTurns - 14) {
      return pickFromOrder(['sentence', 'paragraph', 'full', 'content'])
    }

    if (props.storyTurnNumber <= props.totalStoryTurns - 7) {
      return pickFromOrder(['paragraph', 'full', 'sentence', 'content'])
    }

    return pickFromOrder(['full', 'paragraph', 'sentence', 'content'])
  })

  const summaryText = createMemo(() => {
    const selection = summarySelection()
    const text = selection.text || ''

    if (!text) return ''

    if (viewModeStore.isScriptMode() && !isExpanded()) {
      const sentences = text.match(/[^.!?]+[.!?]+/g) || []
      const firstTwo = sentences.slice(0, 2).join(' ')
      return firstTwo || text
    }

    return text
  })

  const activeSummaryTab = createMemo<SummaryViewMode | SummaryLevel | null>(() => {
    const view = summaryView()
    if (view === 'auto') {
      return 'auto'
    }
    const key = summarySelection().key
    if (key === 'content') return null
    return key
  })

  const summaryTitle = createMemo(() => {
    const key = summarySelection().key
    switch (key) {
      case 'sentence':
        return 'Summary · One sentence'
      case 'paragraph':
        return 'Summary · One paragraph'
      case 'full':
        return 'Summary'
      default:
        return 'Summary'
    }
  })

  const summaryTabs: { key: SummaryViewMode; label: string; description: string }[] = [
    { key: 'auto', label: 'Auto', description: 'Use context-based summary selection' },
    { key: 'sentence', label: 'Sentence', description: 'Show the one-sentence recap' },
    { key: 'full', label: 'Normal', description: 'Show the multi-sentence summary' },
    { key: 'paragraph', label: 'Paragraph', description: 'Show the one-paragraph summary' }
  ]

  const summaryAvailability = createMemo<Record<SummaryLevel, boolean>>(() => ({
    sentence: !!(props.message.sentenceSummary && props.message.sentenceSummary.trim()),
    paragraph: !!(props.message.paragraphSummary && props.message.paragraphSummary.trim()),
    full: !!(props.message.summary && props.message.summary.trim())
  }))

  const toggleExpanded = () => {
    messagesStore.updateMessage(props.message.id, { isExpanded: !isExpanded() })
  }

  const getCompressionRatio = () => {
    if (!shouldShowSummary() || !props.message.content) return null

    const summaryLength = summaryText().length
    const originalLength = props.message.content.length
    
    if (originalLength === 0) return null
    
    const ratio = (summaryLength / originalLength) * 100
    return Math.round(ratio)
  }

  const toggleThink = () => {
    messagesStore.updateMessage(props.message.id, { showThink: !props.message.showThink })
  }
  


  const startEditingContent = () => {
    // Save this message as the last edited message
    localStorage.setItem('lastEditedMessageId', props.message.id)
    localStorage.setItem('lastEditedMessageTime', Date.now().toString())
    setEditContent(props.message.content)
    console.log('[Message.startEditingContent] Loading paragraphs from message:', props.message.paragraphs?.length || 0, props.message.paragraphs)
    setEditParagraphs(props.message.paragraphs || [])  // Initialize with current paragraphs
    setIsEditing(true)
  }

  const saveEdit = async () => {
    console.log('[Message.saveEdit] editParagraphs count:', editParagraphs().length)
    // If we have edited paragraphs (from SceneEditor), save them
    if (editParagraphs().length > 0) {
      const revisionId = props.message.currentMessageRevisionId
      if (!revisionId) {
        console.error('[Message.saveEdit] No currentMessageRevisionId - cannot save paragraphs')
        return
      }

      // Generate flattened content for backward compatibility
      const flattenedContent = paragraphsToText(editParagraphs())

      console.log('[Message.saveEdit] Saving paragraphs to backend:', editParagraphs())

      // Save paragraphs to backend with diffing
      try {
        const result = await saveService.saveParagraphs(
          revisionId,
          props.message.paragraphs || [],
          editParagraphs()
        )
        console.log(`[Message.saveEdit] Saved paragraphs: ${result.created} created, ${result.updated} updated, ${result.deleted} deleted`)
      } catch (error) {
        console.error('[Message.saveEdit] Failed to save paragraphs:', error)
      }

      // Update local state
      console.log('[Message.saveEdit] Updating local state with paragraphs')
      messagesStore.updateMessage(props.message.id, {
        content: flattenedContent,
        paragraphs: editParagraphs()
      })
      console.log('[Message.saveEdit] Local state updated')
    } else {
      // Traditional content editing (no paragraphs)
      const content = editContent()
        .replace(/\r\n/g, '\n') // Normalize Windows line breaks
        .replace(/\n{3,}/g, '\n\n') // Replace 3+ newlines with just 2
        .trim()

      if (content && content !== props.message.content) {
        messagesStore.updateMessage(props.message.id, { content })
      }
    }
    setIsEditing(false)
  }

  const cancelEdit = () => {
    setIsEditing(false)
    setEditContent('')
  }

  const startEditingInstruction = () => {
    // Save this message as the last edited message (instruction edit)
    localStorage.setItem('lastEditedMessageId', `${props.message.id}-instruction`)
    localStorage.setItem('lastEditedMessageTime', Date.now().toString())
    
    // Check if there's a draft to restore
    const draftData = localStorage.getItem(getDraftKey())
    if (draftData) {
      try {
        const draft = JSON.parse(draftData)
        if (draft.originalContent === props.message.instruction) {
          // Restore the draft
          setEditInstruction(draft.content)
        } else {
          // Original changed, start fresh
          setEditInstruction(props.message.instruction || '')
          clearDraft()
        }
      } catch (e) {
        setEditInstruction(props.message.instruction || '')
      }
    } else {
      setEditInstruction(props.message.instruction || '')
    }
    setIsEditingInstruction(true)
  }

  const saveInstructionEdit = () => {
    // Normalize line breaks: replace multiple consecutive newlines with just two
    const instruction = editInstruction()
      .replace(/\r\n/g, '\n') // Normalize Windows line breaks
      .replace(/\n{3,}/g, '\n\n') // Replace 3+ newlines with just 2
      .trim()
    
    if (instruction && instruction !== props.message.instruction) {
      messagesStore.updateMessage(props.message.id, { instruction })
      // Message update already triggers save via messagesStore.updateMessage
      clearDraft() // Clear draft after successful save
    }
    setIsEditingInstruction(false)
    setHasUnsavedChanges(false)
  }

  const cancelInstructionEdit = () => {
    // Ask for confirmation if there are unsaved changes
    if (hasUnsavedChanges() && editInstruction() !== props.message.instruction) {
      if (!confirm('You have unsaved changes. Are you sure you want to cancel?')) {
        return
      }
    }
    setIsEditingInstruction(false)
    setEditInstruction('')
    // Don't clear draft on cancel - keep it for later
  }

  const handleContentKeyPress = (e: KeyboardEvent) => {
    // For contenteditable, Ctrl/Cmd+Enter to save, Escape to cancel
    // Allow Enter for new lines
    if ((e.key === 'Enter' && (e.ctrlKey || e.metaKey))) {
      e.preventDefault()
      saveEdit()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      cancelEdit()
    }
  }

  const handleCut = () => {
    // If holding Ctrl/Cmd, toggle this message in the cut list
    // Otherwise, replace the cut list with just this message
    const event = window.event as KeyboardEvent | MouseEvent | null
    if (event && (event.ctrlKey || event.metaKey)) {
      uiStore.toggleCutMessage(props.message.id)
    } else {
      uiStore.setCutMessage(props.message.id)
    }
  }

  const handleUncut = () => {
    uiStore.removeCutMessage(props.message.id)
  }

  const handleSetAsTarget = () => {
    const targetingMode = uiStore.targetingMode
    if (!targetingMode.active || !targetingMode.branchMessageId || !targetingMode.optionId) return

    // Find the branch message and update the option
    const branchMessage = messagesStore.messages.find(m => m.id === targetingMode.branchMessageId)
    if (!branchMessage || branchMessage.type !== 'branch') return

    const updatedOptions = (branchMessage.options || []).map(opt =>
      opt.id === targetingMode.optionId
        ? {
            ...opt,
            targetNodeId: props.message.nodeId || '',
            targetMessageId: props.message.id
          }
        : opt
    )

    messagesStore.updateMessage(branchMessage.id, {
      ...branchMessage,
      options: updatedOptions
    })

    // Exit targeting mode
    uiStore.cancelTargeting()
  }

  const handlePasteBefore = async () => {
    const cutMessageIds = Array.from(uiStore.cutMessageIds)
    if (cutMessageIds.length === 0) return

    // Get the target node ID (where we're pasting)
    // Use the current message's nodeId, or if it doesn't have one, use the selected node
    const targetNodeId = props.message.nodeId || nodeStore.selectedNodeId || ''

    console.log('[handlePasteBefore] Pasting messages:', {
      cutMessageIds,
      targetNodeId,
      currentMessageId: props.message.id,
      currentMessageNodeId: props.message.nodeId,
      selectedNodeId: nodeStore.selectedNodeId
    })

    if (!targetNodeId) {
      console.error('[handlePasteBefore] No target node ID found!')
      return
    }

    // Find the message that comes before this one to insert after it
    // (so the cut messages appear where the button is - before this message)
    const messages = messagesStore.messages
    const currentIndex = messages.findIndex(m => m.id === props.message.id)

    // Sort cut messages by their original order
    const sortedCutMessages = cutMessageIds.sort((a, b) => {
      const indexA = messages.findIndex(m => m.id === a)
      const indexB = messages.findIndex(m => m.id === b)
      return indexA - indexB
    })

    // Insert messages in order
    let insertAfter: string | null = currentIndex === 0 ? null : messages[currentIndex - 1].id

    for (const messageId of sortedCutMessages) {
      await messagesStore.moveMessage(messageId, insertAfter, targetNodeId)
      insertAfter = messageId // Next message inserts after this one
    }

    // Clear the cut state
    uiStore.clearCut()
  }

  const handlePasteAfter = async () => {
    const cutMessageIds = Array.from(uiStore.cutMessageIds)
    if (cutMessageIds.length === 0) return

    // Get the target node ID (where we're pasting)
    const targetNodeId = props.message.nodeId || nodeStore.selectedNodeId || ''

    console.log('[handlePasteAfter] Pasting messages:', {
      cutMessageIds,
      targetNodeId,
      currentMessageId: props.message.id,
      currentMessageNodeId: props.message.nodeId,
      selectedNodeId: nodeStore.selectedNodeId
    })

    if (!targetNodeId) {
      console.error('[handlePasteAfter] No target node ID found!')
      return
    }

    // Sort cut messages by their original order
    const messages = messagesStore.messages
    const sortedCutMessages = cutMessageIds.sort((a, b) => {
      const indexA = messages.findIndex(m => m.id === a)
      const indexB = messages.findIndex(m => m.id === b)
      return indexA - indexB
    })

    // Insert all messages after the current message
    let insertAfter = props.message.id

    for (const messageId of sortedCutMessages) {
      await messagesStore.moveMessage(messageId, insertAfter, targetNodeId)
      insertAfter = messageId // Next message inserts after this one
    }

    // Clear the cut state
    uiStore.clearCut()
  }

  const handleInstructionKeyPress = (e: KeyboardEvent) => {
    // For contenteditable, Ctrl/Cmd+Enter to save, Escape to cancel
    // Allow Enter for new lines
    if ((e.key === 'Enter' && (e.ctrlKey || e.metaKey))) {
      e.preventDefault()
      saveInstructionEdit()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      cancelInstructionEdit()
    }
  }

  const canRegenerateFromHere = () => {
    return props.message.type !== 'event' && props.message.instruction && !props.message.isQuery && messagesStore.canRegenerateFromMessage(props.message.id)
  }

  const canRegenerateQuery = () => {
    return props.message.type !== 'event' && props.message.instruction && props.message.isQuery && props.message.role === 'assistant'
  }

  const canRegenerateThisAssistant = () => {
    return props.message.type !== 'event' && messagesStore.canRegenerateAssistantMessage(props.message.id)
  }

  // Check if instruction should be truncated (>100 words)
  const shouldTruncateInstruction = createMemo(() => {
    if (!props.message.instruction || props.isGenerating) return false
    const wordCount = props.message.instruction.split(/\s+/).length
    return wordCount > 100
  })

  // Get truncated instruction text (first 100 words)
  const getTruncatedInstruction = createMemo(() => {
    if (!props.message.instruction) return ''
    if (!shouldTruncateInstruction()) return props.message.instruction
    
    const words = props.message.instruction.split(/\s+/)
    const first100Words = words.slice(0, 100).join(' ')
    
    // Add ellipsis if we're truncating
    return first100Words + '...'
  })

  // Get the display instruction based on expanded state
  const getDisplayInstruction = () => {
    if (isInstructionExpanded() || !shouldTruncateInstruction()) {
      return props.message.instruction
    }
    return getTruncatedInstruction()
  }

  // Check if this is the last message in the story
  const isLastMessage = () => {
    const messages = messagesStore.messages
    return messages[messages.length - 1]?.id === props.message.id
  }

  return (
    <>
      <Show when={uiStore.hasCutMessage() && !uiStore.isCut(props.message.id)}>
        <div class={styles.pasteContainer}>
          <button
            class={styles.pasteButton}
            onClick={handlePasteBefore}
            title={`Insert ${uiStore.getCutMessageCount()} cut message${uiStore.getCutMessageCount() > 1 ? 's' : ''} before this message`}
          >
            <BsArrowDownCircle /> Insert {uiStore.getCutMessageCount()} Message{uiStore.getCutMessageCount() > 1 ? 's' : ''} Before
          </button>
        </div>
      </Show>
      <Show when={props.message.role === 'assistant' && props.message.instruction && !isEditing() && props.message.type !== 'event'}>
        <div class={`${styles.message} ${styles.messageInstruction} ${!messagesStore.isMessageActive(props.message.id) ? styles.messageInactive : ''}`} data-message-id={`${props.message.id}-instruction`}>
          <Show when={!isEditingInstruction()}>
            <div class={styles.content}>
              {getDisplayInstruction()}
              <Show when={shouldTruncateInstruction()}>
                <button
                  class={`${styles.actionButton} ${styles.summaryToggle}`}
                  onClick={() => {
                    const newExpanded = !isInstructionExpanded()
                    setIsInstructionExpanded(newExpanded)
                    // Update the message store with the new expansion state
                    messagesStore.updateMessage(props.message.id, { isInstructionExpanded: newExpanded })
                  }}
                  title={isInstructionExpanded() ? "Show less" : "Show full instruction"}
                  style={{ "margin-top": "8px" }}
                >
                  {isInstructionExpanded() ? (
                    <><BsChevronUp /> Show less</>
                  ) : (
                    <><BsChevronDown /> Show full instruction</>
                  )}
                </button>
              </Show>
            </div>
          </Show>
          <Show when={isEditingInstruction()}>
            <div 
              class={`${styles.content} ${styles.contentEditable}`}
              contentEditable={true}
              onPaste={(e) => {
                // Prevent default paste behavior and insert sanitized text with limited formatting
                e.preventDefault();
                const rawHtml = e.clipboardData?.getData('text/html') || '';
                const rawText = e.clipboardData?.getData('text/plain') || '';
                const text = processPastedText(rawText, rawHtml);
                const selection = window.getSelection();
                if (!selection?.rangeCount) return;

                selection.deleteFromDocument();
                const textNode = document.createTextNode(text);
                selection.getRangeAt(0).insertNode(textNode);
                
                // Move cursor to end of inserted text
                const range = document.createRange();
                range.selectNodeContents(textNode);
                range.collapse(false);
                selection.removeAllRanges();
                selection.addRange(range);
                
                // Trigger input handler manually - use custom text extraction
                const currentText = getPlainTextFromContentEditable(e.currentTarget as HTMLDivElement);
                setEditInstruction(currentText);
                
                // Auto-save draft after a short delay
                if (autoSaveTimer) {
                  clearTimeout(autoSaveTimer);
                }
                autoSaveTimer = window.setTimeout(() => {
                  saveDraft(currentText);
                }, 500);
              }}
              onInput={(e) => {
                // Use custom function to extract text properly
                const text = getPlainTextFromContentEditable(e.currentTarget as HTMLDivElement);
                setEditInstruction(text);
                
                // Auto-save draft after a short delay
                if (autoSaveTimer) {
                  clearTimeout(autoSaveTimer);
                }
                autoSaveTimer = window.setTimeout(() => {
                  saveDraft(text);
                }, 500); // Save after 500ms of no typing
              }}
              onKeyDown={handleInstructionKeyPress}
              ref={(el) => {
                if (el) {
                  // Set initial content
                  el.innerText = editInstruction();
                  // Focus and place cursor at end, then scroll into view
                  setTimeout(() => {
                    el.focus();
                    const selection = window.getSelection();
                    const range = document.createRange();
                    range.selectNodeContents(el);
                    range.collapse(false);
                    selection?.removeAllRanges();
                    selection?.addRange(range);
                    
                    // Scroll to the top of the contenteditable with some offset
                    el.scrollIntoView({ 
                      behavior: 'smooth', 
                      block: 'start',
                      inline: 'nearest' 
                    });
                    
                    // Additional offset to account for any fixed headers
                    window.scrollBy({
                      top: -20, // Small offset from top
                      behavior: 'smooth'
                    });
                  }, 0);
                }
              }}
            >
            </div>
          </Show>
          <div class={styles.actions}>
            <div class={styles.timestamp}>
              Instruction (part of response below)
              <Show when={hasUnsavedChanges() && !isEditingInstruction()}>
                <span style={{ 
                  color: 'var(--warning-color)', 
                  'margin-left': '8px',
                  'font-weight': 'bold' 
                }}>
                  • Draft saved
                </span>
              </Show>
            </div>
            <div class={styles.actionButtons}>
              <Show when={!isEditingInstruction()}>
                <button
                  class={`${styles.actionButton} ${styles.editButton}`}
                  onClick={startEditingInstruction}
                  title="Edit instruction"
                >
                  <BsPencil />
                </button>
              </Show>
              <Show when={isEditingInstruction()}>
                <button
                  class={`${styles.actionButton} ${styles.saveButton}`}
                  onClick={saveInstructionEdit}
                  title="Save changes (Ctrl+Enter)"
                >
                  <BsCheck />
                </button>
                <button
                  class={`${styles.actionButton} ${styles.cancelButton}`}
                  onClick={cancelInstructionEdit}
                  title="Cancel editing (Escape)"
                >
                  <BsX />
                </button>
              </Show>
            </div>
          </div>
        </div>
      </Show>
      <div
        ref={messageRef}
        data-message-id={props.message.id}
        class={`${styles.message} ${styles.messageAssistant} ${props.message.isQuery ? styles.messageQuery : ''} ${props.message.isSummarizing ? styles.messageSummarizing : ''} ${props.message.isAnalyzing ? styles.messageAnalyzing : ''} ${props.message.type === 'event' ? styles.messageEvent : ''} ${uiStore.isCut(props.message.id) ? styles.messageCut : ''} ${!messagesStore.isMessageActive(props.message.id) ? styles.messageInactive : ''}`}
      >
        <div class={styles.content}>
        <Show when={isEditing()}>
          <SceneEditorWrapper
            messageId={props.message.id}
            onParagraphsUpdate={(paragraphs) => setEditParagraphs(paragraphs)}
          />
        </Show>
        <Show when={!isEditing()}>
          <Show when={canRegenerateThisAssistant()}>
            <div>
              <em>Response cleared - click to regenerate</em>
              <MessageRegenerateButton
                onRegenerate={(maxTokens) => handleRegenerateFromMessage(props.message.id, props.message.instruction!, maxTokens)}
                title="Regenerate this response"
                icon={<><BsRewindBtnFill /> Regenerate Response</>}
              />
            </div>
          </Show>
          <Show when={!canRegenerateThisAssistant()}>
            <Show when={shouldShowSummary() && !isExpanded()}>
              <div class={styles.summary}>
                <div class={styles.summaryHeader}>
                  <div class={styles.summaryTitle}>{summaryTitle()}</div>
                  <div class={styles.summaryTabs}>
                    <For each={summaryTabs}>
                      {(tab) => {
                        const isAvailable = () => tab.key === 'auto' || summaryAvailability()[tab.key as SummaryLevel]
                        const isActive = () => activeSummaryTab() === tab.key
                        return (
                          <button
                            class={`${styles.summaryTab} ${isActive() ? styles.summaryTabActive : ''}`}
                            disabled={!isAvailable()}
                            onClick={() => uiStore.setSummaryView(tab.key)}
                            title={tab.description}
                          >
                            {tab.label}
                          </button>
                        )
                      }}
                    </For>
                  </div>
                </div>
                <div class={styles.summaryContent}>
                  {summaryText()}
                </div>
              </div>
              <button
                class={`${styles.actionButton} ${styles.summaryToggle}`}
                onClick={toggleExpanded}
                title="Show full content"
              >
                <BsChevronDown /> Show full content
              </button>
            </Show>
            <Show when={!shouldShowSummary() || isExpanded()}>
              <Show when={props.message.type === 'branch'} fallback={
                <>
                  <Show when={props.message.type === 'event'}>
                    <span class={styles.eventIcon}>📌 </span>
                  </Show>
                  {props.message.content}
                </>
              }>
                <BranchMessage message={props.message} />
              </Show>
              <Show when={shouldShowSummary() && isExpanded()}>
                <button
                  class={`${styles.actionButton} ${styles.summaryToggle}`}
                  onClick={toggleExpanded}
                  title="Show summary"
                >
                  <BsChevronUp /> Show summary
                </button>
              </Show>
              <Show when={props.message.think}>
                <Show when={!props.message.showThink}>
                  <button
                    class={`${styles.actionButton} ${styles.thinkToggle}`}
                    onClick={toggleThink}
                    title="Show AI thinking"
                  >
                    <BsLightbulb /> Show thinking
                  </button>
                </Show>
                <Show when={props.message.showThink}>
                  <div class={styles.thinkSection}>
                    <div class={styles.thinkTitle}>
                      <BsLightbulb /> AI Thinking:
                    </div>
                    {props.message.think}
                  </div>
                  <button
                    class={`${styles.actionButton} ${styles.thinkToggle}`}
                    onClick={toggleThink}
                    title="Hide AI thinking"
                  >
                    <BsChevronUp /> Hide thinking
                  </button>
                </Show>
              </Show>
            </Show>
            
          </Show>
        </Show>
      </div>
      {/* In script mode, show script code and data changes */}
      <Show when={viewModeStore.isScriptMode() && props.message.script && props.message.role === 'assistant' && !props.message.isQuery}>
        <div class={styles.scriptModeSection}>
          <div class={styles.scriptCode}>
            <h4>Script Code:</h4>
            <pre>{props.message.script?.split('\n').filter(line => !line.trim().startsWith('//')).join('\n')}</pre>
          </div>
        </div>
      </Show>

      <Show when={props.message.script && props.message.role === 'assistant' && !props.message.isQuery}>
        {(() => {
          const dataState = scriptDataStore.getDataStateForMessage(props.message.id)
          // Always show ScriptDataDiff in script mode, or when it has changes in normal mode
          const shouldShow = viewModeStore.isScriptMode() || dataState
          return shouldShow && dataState ? (
            <ScriptDataDiff
              before={dataState.before}
              after={dataState.after}
              messageId={props.message.id}
            />
          ) : null
        })()}
      </Show>
      <Show when={showAnalysisDebug()}>
        <div>
          <div>
            <BsInfoCircle /> Message Debug Data:
          </div>
          <pre>
            {JSON.stringify({
              // Message metadata
              id: props.message.id,
              chapterId: props.message.chapterId || 'none',
              
              // Model info
              model: props.message.model || 'unknown',
              
              // Token usage and caching
              tokens: (() => {
                const usage = getTokenUsage(props.message)
                return {
                  input_normal: usage?.input_normal || 0,
                  input_cache_read: usage?.input_cache_read || 0,
                  input_cache_write: usage?.input_cache_write || 0,
                  output_normal: usage?.output_normal || 0,
                  totalInput: usage ? usage.input_normal + usage.input_cache_read + usage.input_cache_write : 0,
                  tokensPerSecond: props.message.tokensPerSecond || 0
                }
              })(),
              
              // Cost information
              costs: messageCost() ? {
                promptCost: `$${messageCost()!.promptCost.toFixed(6)}`,
                completionCost: `$${messageCost()!.completionCost.toFixed(6)}`,
                cacheReadCost: `$${messageCost()!.cacheReadCost.toFixed(6)}`,
                cacheWriteCost: `$${messageCost()!.cacheWriteCost.toFixed(6)}`,
                totalCost: `$${messageCost()!.totalCost.toFixed(6)}`,
                cacheReadSavings: `$${messageCost()!.cacheReadSavings.toFixed(6)}`,
                pricing: {
                  promptPerToken: `$${messageCost()!.promptPrice}`,
                  completionPerToken: `$${messageCost()!.completionPrice}`,
                  cacheReadPerToken: `$${messageCost()!.cacheReadPrice}`,
                  cacheWritePerToken: `$${messageCost()!.cacheWritePrice}`,
                  promptPerMillion: `$${(messageCost()!.promptPrice * 1_000_000).toFixed(2)}`,
                  completionPerMillion: `$${(messageCost()!.completionPrice * 1_000_000).toFixed(2)}`,
                  cacheReadPerMillion: `$${(messageCost()!.cacheReadPrice * 1_000_000).toFixed(2)}`,
                  cacheWritePerMillion: `$${(messageCost()!.cacheWritePrice * 1_000_000).toFixed(2)}`
                }
              } : 'No pricing data available',
              
              // Scene analysis data
              sceneAnalysis: props.message.sceneAnalysis || null,
              isAnalyzing: props.message.isAnalyzing || false,
              hasSceneAnalysis: !!props.message.sceneAnalysis,
              sceneAnalysisKeys: props.message.sceneAnalysis ? Object.keys(props.message.sceneAnalysis) : [],
              sceneAnalysisEmpty: props.message.sceneAnalysis ? Object.keys(props.message.sceneAnalysis).length === 0 : 'no sceneAnalysis',
              locations: props.message.sceneAnalysis?.locations || [],
              
              // Debug info removed - no longer needed with unified client
            }, null, 2)}
          </pre>
        </div>
      </Show>
      <div class={styles.actions}>
        <div class={styles.timestamp}>
          <span class={styles.tokenInfo} style="color: var(--primary-color); font-weight: bold;">
            Order: {props.message.order}
          </span>
          <Show when={props.message.role === 'assistant' && props.message.tokensPerSecond}>
            <span class={styles.tokenInfo}>
              {props.message.tokensPerSecond} tok/s
            </span>
          </Show>
          <Show when={props.message.isQuery}>
            <span class={styles.tokenInfo}>
              Query
            </span>
          </Show>
          <Show when={props.message.role === 'assistant' && getTokenUsage(props.message)}>
            {(() => {
              const usage = getTokenUsage(props.message)!
              const totalInput = usage.input_normal + usage.input_cache_read + usage.input_cache_write
              return (
                <>
                  <span class={styles.tokenInfo}>
                    {totalInput} pt
                  </span>
                  <Show when={usage.input_cache_read > 0}>
                    <span class={`${styles.tokenInfo} ${styles.cacheHit}`}>
                      {usage.input_cache_read} cached
                    </span>
                  </Show>
                  <Show when={usage.input_cache_write > 0}>
                    <span class={styles.tokenInfo}>
                      {usage.input_cache_write} cache write
                    </span>
                  </Show>
                </>
              )
            })()}
          </Show>
          <Show when={getCompressionRatio() !== null}>
            <span class={styles.tokenInfo}>
              {getCompressionRatio()}% size
            </span>
          </Show>
        </div>
        <div class={styles.actionButtons}>
          <Show when={canRegenerateFromHere()}>
            <MessageRegenerateButton
              onRegenerate={(maxTokens) => handleRegenerateFromMessage(props.message.id, props.message.instruction!, maxTokens)}
              title="Regenerate story from this point"
              icon={<BsRewindBtnFill />}
            />
          </Show>
          <Show when={canRegenerateQuery()}>
            <MessageRegenerateButton
              onRegenerate={(maxTokens) => handleRegenerateQuery(props.message.id, props.message.instruction!, maxTokens)}
              title="Regenerate this query response"
              icon={<BsArrowRepeat />}
            />
          </Show>
          <Show when={isEditing()}>
            <button
              class={`${styles.actionButton} ${styles.saveButton}`}
              onClick={saveEdit}
              title="Save changes"
            >
              <BsCheck />
            </button>
            <button
              class={`${styles.actionButton} ${styles.cancelButton}`}
              onClick={cancelEdit}
              title="Cancel editing"
            >
              <BsX />
            </button>
          </Show>
          <Show when={props.message.role === 'assistant' && !props.message.isQuery && !isEditing()}>
            <button
              class={`${styles.actionButton} ${styles.editButton}`}
              onClick={startEditingContent}
              title="Edit story content"
            >
              <BsPencil />
            </button>
          </Show>
          <Show when={uiStore.isTargeting() && props.message.type !== 'branch'}>
            <button
              class={`${styles.actionButton} ${styles.targetButton}`}
              onClick={handleSetAsTarget}
              title="Set as target for branch option"
            >
              🎯 Set as Target
            </button>
          </Show>
          <Show when={props.message.role === 'assistant' && !isEditing()}>
            <Show when={props.message.script || props.message.type === 'event'}>
              <button
                class={`${styles.actionButton} ${styles.scriptButton}`}
                onClick={() => setShowScriptModal(true)}
                title={props.message.type === 'event' ? "Edit event script" : "Edit turn script"}
              >
                <BsCodeSlash />
              </button>
            </Show>
            <Show when={!props.message.isQuery && props.message.type !== 'event'}>
              <MessageActionsDropdown
                onSummarize={() => handleSummarizeMessage(props.message.id)}
                onAnalyze={() => handleAnalyzeMessage(props.message.id)}
                onToggleDebug={() => setShowAnalysisDebug(!showAnalysisDebug())}
                onEditScript={props.message.script ? undefined : () => setShowScriptModal(true)}
                onRewrite={() => rewriteDialogStore.show([props.message.id])}
                onCut={handleCut}
                onUncut={handleUncut}
                isCut={uiStore.isCut(props.message.id)}
                isSummarizing={props.message.isSummarizing}
                isAnalyzing={props.message.isAnalyzing}
                hasSummary={Boolean(
                  props.message.sentenceSummary ||
                    props.message.summary ||
                    props.message.paragraphSummary,
                )}
                hasAnalysis={!!props.message.sceneAnalysis}
                hasScript={!!props.message.script}
                showDebug={showAnalysisDebug()}
              />
            </Show>
            <Show when={props.message.isQuery || props.message.type === 'event'}>
              <MessageActionsDropdown
                onCut={handleCut}
                onUncut={handleUncut}
                isCut={uiStore.isCut(props.message.id)}
                onToggleDebug={() => setShowAnalysisDebug(!showAnalysisDebug())}
                showDebug={showAnalysisDebug()}
                onSummarize={() => {}}
                onAnalyze={() => {}}
              />
            </Show>
          </Show>
          <Show when={!isEditing()}>
            <button
              class={`${styles.actionButton}`}
              onClick={() => setShowVersionHistory(true)}
              title="View version history"
            >
              <BsClockHistory />
            </button>
            <button
              class={`${styles.actionButton} ${styles.deleteButton}`}
              onClick={() => messagesStore.deleteMessage(props.message.id)}
              title="Delete this message"
            >
              <BsX />
            </button>
          </Show>
        </div>
      </div>
    </div>
    
    <Show when={showScriptModal()}>
      <MessageScriptModal
        message={props.message}
        onClose={() => setShowScriptModal(false)}
      />
    </Show>

    <Show when={showVersionHistory()}>
      <MessageVersionHistory
        messageId={props.message.id}
        onClose={() => setShowVersionHistory(false)}
      />
    </Show>

    <Show when={uiStore.hasCutMessage() && !uiStore.isCut(props.message.id) && isLastMessage()}>
      <div class={styles.pasteContainer}>
        <button
          class={styles.pasteButton}
          onClick={handlePasteAfter}
          title={`Insert ${uiStore.getCutMessageCount()} cut message${uiStore.getCutMessageCount() > 1 ? 's' : ''} after this message`}
        >
          <BsArrowDownCircle /> Insert {uiStore.getCutMessageCount()} Message{uiStore.getCutMessageCount() > 1 ? 's' : ''} After (End)
        </button>
      </div>
    </Show>
    </>
  )
}
