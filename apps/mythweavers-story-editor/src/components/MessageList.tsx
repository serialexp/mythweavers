import { Component, For, type JSX, Show, createEffect, createMemo, onCleanup, onMount } from 'solid-js'
import { createDisplayMessagesMemo } from '../utils/messageFiltering'
import MessageListItems from './MessageListItems'

// Inline styles for MessageList
const listStyles = {
  messages: {
    flex: '1',
    overflow: 'auto',
    padding: '0',
    display: 'flex',
    'flex-direction': 'column',
    gap: '0',
    'scroll-behavior': 'smooth',
  } as JSX.CSSProperties,

  loadingMessage: {
    padding: '1rem',
    'background-color': 'var(--bg-secondary)',
    'border-radius': '8px',
    'border-left': '3px solid var(--accent-color)',
  } as JSX.CSSProperties,

  loadingMessageContent: {
    color: 'var(--text-secondary)',
    'font-style': 'italic',
    display: 'flex',
    'align-items': 'center',
    gap: '0.5rem',
  } as JSX.CSSProperties,

  orphanedChaptersSection: {
    'margin-bottom': '1rem',
    padding: '1rem',
    'background-color': 'var(--bg-secondary)',
    'border-radius': '8px',
    border: '1px solid var(--warning-color)',
  } as JSX.CSSProperties,

  orphanedChaptersTitle: {
    margin: '0 0 0.75rem 0',
    color: 'var(--warning-color)',
    'font-size': '0.95rem',
    'font-weight': '600',
  } as JSX.CSSProperties,

  orphanedChapterItem: {
    display: 'flex',
    'justify-content': 'space-between',
    'align-items': 'center',
    padding: '0.5rem',
    'background-color': 'var(--bg-primary)',
    'border-radius': '4px',
    'margin-bottom': '0.5rem',
  } as JSX.CSSProperties,

  orphanedChapterInfo: {
    display: 'flex',
    'flex-direction': 'column',
    gap: '0.25rem',
  } as JSX.CSSProperties,

  orphanedChapterTitle: {
    'font-weight': '500',
    color: 'var(--text-primary)',
  } as JSX.CSSProperties,

  orphanedChapterId: {
    'font-size': '0.8rem',
    color: 'var(--text-secondary)',
    'font-family': 'monospace',
  } as JSX.CSSProperties,

  orphanedChapterActions: {
    display: 'flex',
    gap: '0.5rem',
  } as JSX.CSSProperties,

  createMarkerButton: {
    padding: '0.375rem 0.75rem',
    'font-size': '0.85rem',
    background: 'var(--accent-color)',
    color: 'white',
    border: 'none',
    'border-radius': '4px',
    cursor: 'pointer',
    transition: 'background 0.2s',
  } as JSX.CSSProperties,

  deleteOrphanedButton: {
    padding: '0.375rem 0.75rem',
    'font-size': '0.85rem',
    background: 'transparent',
    color: 'var(--error-color)',
    border: '1px solid var(--error-color)',
    'border-radius': '4px',
    cursor: 'pointer',
    transition: 'all 0.2s',
  } as JSX.CSSProperties,
}

interface MessageListProps {
  isLoading: boolean
  hasStoryMessages: boolean
  isGenerating: boolean
  model?: string
  provider?: 'ollama' | 'openrouter' | 'anthropic'
}

export const MessageList: Component<MessageListProps> = (props) => {
  // Hooks removed - generation now handled elsewhere

  // Get the filtered messages directly
  const displayMessages = createDisplayMessagesMemo()

  // Orphaned chapters no longer exist - chapters are now nodes

  let messagesRef: HTMLDivElement | undefined
  let previousMessageCount = displayMessages().length
  let scrollPositionBeforeUpdate: number | null = null
  let hasRestoredInitialScroll = false

  // Chapter handlers removed - chapters are now nodes
  /*
    const handleEditChapterTitle = async (chapter: any) => {
        const newTitle = prompt("Enter new chapter title:", chapter.title);
        if (newTitle && newTitle !== chapter.title) {
            try {
                // Chapters are now nodes - update through node system
                console.log('Chapter update not implemented for nodes');
            } catch (error) {
                console.error("Failed to update chapter title:", error);
                alert("Failed to update chapter title");
            }
        }
    };

    const handleDeleteChapter = async (chapter: Chapter) => {
        const isPlaceholder = (chapter as any).isPlaceholder === true;

        if (isPlaceholder) {
            // For placeholder chapters, just delete the marker message
            const markerMessage = displayMessages().find(
                (m) => m.type === "chapter" && m.chapterId === chapter.id,
            );
            if (markerMessage && confirm("Delete this chapter marker?")) {
                messagesStore.deleteMessage(markerMessage.id);
            }
        } else {
            // For real chapters, use the existing delete logic
            const confirmMessage = `Delete chapter "${chapter.title}"?\n\nMessages in this chapter will be moved to the previous chapter (if one exists) or become standalone messages.`;
            if (confirm(confirmMessage)) {
                try {
                    // Chapters are now nodes - delete through node system
                    console.log('Chapter delete not implemented for nodes');
                } catch (error) {
                    console.error("Failed to delete chapter:", error);
                    alert("Failed to delete chapter");
                }
            }
        }
    };

    const handleGenerateChapterSummary = async (chapterId: string) => {
        try {
            // Chapters are now nodes - generate summary through node system
            console.log('Chapter summary generation not implemented for nodes');
        } catch (error) {
            console.error("Failed to generate chapter summary:", error);
            // Show more specific error message
            const errorMessage = getErrorMessage(error);
            alert(errorMessage);
        }
    };

    const handleCreateMarkerForOrphanedChapter = (chapter: Chapter) => {
        // Create a chapter marker message at the beginning of the messages
        const markerMessage: MessageType = {
            id: generateMessageId(),
            role: "assistant" as const,
            content: "",
            type: "chapter" as const,
            chapterId: chapter.id,
            timestamp: new Date(),
            order: 0,  // Will be set properly by insertMessage
            isQuery: false,
        };

        // Insert at the beginning (after null means at start)
        messagesStore.insertMessage(null, markerMessage);

        // The chapter will automatically be removed from orphaned list
        // when the messages update and the computed signal recalculates
    };

    const handleCopyChapter = (chapter: Chapter) => {
        // Get ALL messages belonging to this chapter from the store (including compacted ones)
        const chapterMessages = messagesStore.messages.filter(msg =>
            msg.chapterId === chapter.id ||
            (msg.type === "chapter" && msg.chapterId === chapter.id)
        );

        // Sort messages by timestamp to maintain order
        const sortedMessages = [...chapterMessages].sort((a, b) => {
            const timeA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
            const timeB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
            return timeA - timeB;
        });

        // Create the export object
        const chapterExport = {
            chapter: {
                id: chapter.id,
                title: chapter.title,
                summary: chapter.summary,
                order: chapter.order,
                createdAt: chapter.createdAt,
                updatedAt: chapter.updatedAt,
            },
            messages: sortedMessages.map(msg => ({
                ...msg,
                // Don't include the original message ID to avoid conflicts
                id: undefined,
            })),
        };

        // Copy to clipboard
        navigator.clipboard.writeText(JSON.stringify(chapterExport, null, 2))
            .then(() => {
                alert(`Chapter "${chapter.title}" copied to clipboard as JSON (${sortedMessages.length} messages)`);
            })
            .catch(err => {
                console.error("Failed to copy to clipboard:", err);
                alert("Failed to copy chapter to clipboard");
            });
    };

    const handleMoveChapterUp = (chapter: Chapter) => {
        messagesStore.moveChapterUp(chapter.id);
    };

    const handleMoveChapterDown = (chapter: any) => {
        messagesStore.moveChapterDown(chapter.id);
    };
    */

  // Save scroll position before unload
  const saveScrollPosition = () => {
    if (messagesRef) {
      // Always save the current scroll position
      localStorage.setItem('messagesScrollTop', messagesRef.scrollTop.toString())
    }
  }

  // Track message changes and preserve scroll position
  createEffect(() => {
    const currentMessageCount = displayMessages().length

    // Before the DOM updates, save the current scroll position
    if (messagesRef && currentMessageCount !== previousMessageCount) {
      scrollPositionBeforeUpdate = messagesRef.scrollTop

      // After DOM updates, restore the scroll position
      requestAnimationFrame(() => {
        if (messagesRef && scrollPositionBeforeUpdate !== null) {
          // Check if user was near the bottom (within 100px)
          const wasNearBottom = messagesRef.scrollHeight - scrollPositionBeforeUpdate - messagesRef.clientHeight < 100

          if (wasNearBottom && currentMessageCount > previousMessageCount) {
            // If user was near bottom and messages were added, scroll to bottom
            messagesRef.scrollTop = messagesRef.scrollHeight
          } else {
            // Otherwise, maintain the exact scroll position
            messagesRef.scrollTop = scrollPositionBeforeUpdate
          }

          scrollPositionBeforeUpdate = null
        }
      })
    }

    previousMessageCount = currentMessageCount
  })

  // Track if user has manually scrolled during generation
  let userHasScrolledDuringGeneration = false
  let wasGenerating = false

  // Memoize whether we're currently generating to avoid expensive array iteration
  const isCurrentlyGenerating = createMemo(() => {
    if (props.isLoading) return true
    // Only check the last message for efficiency
    const messages = displayMessages()
    const lastMessage = messages[messages.length - 1]
    return !!(lastMessage?.content && !lastMessage.tokensPerSecond)
  })

  // Also handle when content is being streamed (message content updates)
  createEffect(() => {
    const generating = isCurrentlyGenerating()

    // Reset flag when generation starts
    if (generating && !wasGenerating) {
      userHasScrolledDuringGeneration = false
    }

    wasGenerating = generating

    // Track the last message content to detect streaming updates
    const messages = displayMessages()
    const lastMessage = messages[messages.length - 1]
    if (lastMessage && messagesRef && generating) {
      // Only auto-scroll if user hasn't manually scrolled during this generation
      if (!userHasScrolledDuringGeneration) {
        const isNearBottom = messagesRef.scrollHeight - messagesRef.scrollTop - messagesRef.clientHeight < 100

        if (isNearBottom) {
          // Auto-scroll during streaming if user is near bottom
          requestAnimationFrame(() => {
            if (messagesRef && !userHasScrolledDuringGeneration) {
              messagesRef.scrollTop = messagesRef.scrollHeight
            }
          })
        }
      }
    }
  })

  // Detect manual scrolling during generation
  const handleScroll = () => {
    // Always save the current scroll position
    saveScrollPosition()

    // If generating and user scrolls away from bottom, mark as manually scrolled
    if (messagesRef && isCurrentlyGenerating()) {
      const isNearBottom = messagesRef.scrollHeight - messagesRef.scrollTop - messagesRef.clientHeight < 100
      if (!isNearBottom) {
        userHasScrolledDuringGeneration = true
      }
    }
  }

  // Unified scroll restoration effect - runs after messages are loaded
  createEffect(() => {
    // Only run once when messages are loaded and DOM is ready
    if (!hasRestoredInitialScroll && displayMessages().length > 0 && messagesRef) {
      // Use double requestAnimationFrame to ensure DOM is fully rendered
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (!messagesRef || hasRestoredInitialScroll) return

          // Priority 1: Check for last edited message
          const lastEditedMessageId = localStorage.getItem('lastEditedMessageId')
          const lastEditedTime = localStorage.getItem('lastEditedMessageTime')

          if (lastEditedMessageId && lastEditedTime) {
            const timeSinceEdit = Date.now() - Number.parseInt(lastEditedTime, 10)
            const twentyFourHours = 24 * 60 * 60 * 1000

            if (timeSinceEdit < twentyFourHours) {
              // Try to find the message element
              const messageElement = messagesRef.querySelector(`[data-message-id="${lastEditedMessageId}"]`)

              if (messageElement) {
                // Scroll to the edited message
                messageElement.scrollIntoView({
                  behavior: 'smooth',
                  block: 'center',
                })

                // Keep the scroll information for subsequent reloads
                // It will be naturally overwritten when user edits a different message
                hasRestoredInitialScroll = true
                return
              }
            } else {
              // Only clear if too old (>24 hours)
              localStorage.removeItem('lastEditedMessageId')
              localStorage.removeItem('lastEditedMessageTime')
            }
          }

          // Priority 2: Fall back to saved scroll position
          const savedScrollTop = localStorage.getItem('messagesScrollTop')
          if (savedScrollTop) {
            messagesRef.scrollTop = Number.parseInt(savedScrollTop, 10)
            // Don't clear this - it's updated continuously
          }

          hasRestoredInitialScroll = true
        })
      })
    }
  })

  // Setup event listeners on mount
  onMount(() => {
    // Save scroll position when user scrolls
    if (messagesRef) {
      messagesRef.addEventListener('scroll', handleScroll)
    }

    // Save scroll position before page unload
    window.addEventListener('beforeunload', saveScrollPosition)
  })

  onCleanup(() => {
    if (messagesRef) {
      messagesRef.removeEventListener('scroll', handleScroll)
    }
    window.removeEventListener('beforeunload', saveScrollPosition)
  })

  return (
    <>
      <div class="message-list-container" style={listStyles.messages} ref={messagesRef}>
        {/* Orphaned chapters section removed - chapters are now nodes */}
        <Show when={false}>
          <div style={listStyles.orphanedChaptersSection}>
            <h3 style={listStyles.orphanedChaptersTitle}>Orphaned Chapters (missing markers)</h3>
            <For each={[]}>
              {(_chapter) => (
                <div style={listStyles.orphanedChapterItem}>
                  <div style={listStyles.orphanedChapterInfo}>
                    <span style={listStyles.orphanedChapterTitle}>{'Untitled Chapter'}</span>
                    <span style={listStyles.orphanedChapterId}>ID: {'unknown'}...</span>
                  </div>
                  <div style={listStyles.orphanedChapterActions}>
                    <button
                      style={listStyles.createMarkerButton}
                      onClick={() => console.log('Chapters are now nodes')}
                      title="Create marker for this chapter"
                    >
                      Create Marker
                    </button>
                    <button
                      style={listStyles.deleteOrphanedButton}
                      onClick={() => console.log('Chapters are now nodes')}
                      title="Delete this orphaned chapter"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              )}
            </For>
          </div>
        </Show>
        <MessageListItems
          isGenerating={props.isGenerating}
          // Chapter handlers removed - chapters are now managed through nodes
        />
        <Show when={props.isLoading}>
          <div style={listStyles.loadingMessage}>
            <div style={listStyles.loadingMessageContent}>Thinking...</div>
          </div>
        </Show>
      </div>
    </>
  )
}
