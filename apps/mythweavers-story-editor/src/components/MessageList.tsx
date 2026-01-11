import { IconButton } from '@mythweavers/ui'
import { BsChevronUp } from 'solid-icons/bs'
import { Component, For, Show, createEffect, createMemo, createSignal, onCleanup, onMount } from 'solid-js'
import { createDisplayMessagesMemo } from '../utils/messageFiltering'
import MessageListItems from './MessageListItems'
import * as styles from './MessageList.css'
import * as viewStyles from './ViewStyles.css'

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
  const [showScrollToTop, setShowScrollToTop] = createSignal(false)

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

    // Update scroll to top button visibility
    if (messagesRef) {
      setShowScrollToTop(messagesRef.scrollTop > 100)
    }

    // If generating and user scrolls away from bottom, mark as manually scrolled
    if (messagesRef && isCurrentlyGenerating()) {
      const isNearBottom = messagesRef.scrollHeight - messagesRef.scrollTop - messagesRef.clientHeight < 100
      if (!isNearBottom) {
        userHasScrolledDuringGeneration = true
      }
    }
  }

  const handleScrollToTop = () => {
    if (messagesRef) {
      messagesRef.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  // Unified scroll restoration effect - runs after messages are loaded
  createEffect(() => {
    // Only run once when messages are loaded and DOM is ready
    if (!hasRestoredInitialScroll && displayMessages().length > 0 && messagesRef) {
      // Wait for content to stabilize before restoring scroll position
      // The editor content loads asynchronously, so we need to wait for
      // scrollHeight to stop changing before we can accurately restore position
      let lastHeight = 0
      let stableCount = 0
      const STABILITY_THRESHOLD = 3 // Number of consecutive stable checks required
      const CHECK_INTERVAL = 50 // ms between checks
      const MAX_WAIT_TIME = 2000 // Maximum time to wait for stability

      const startTime = Date.now()

      const checkAndRestore = () => {
        if (!messagesRef || hasRestoredInitialScroll) return

        const currentHeight = messagesRef.scrollHeight

        if (currentHeight === lastHeight) {
          stableCount++
        } else {
          stableCount = 0
          lastHeight = currentHeight
        }

        // Content is stable or we've waited too long
        if (stableCount >= STABILITY_THRESHOLD || Date.now() - startTime > MAX_WAIT_TIME) {
          performScrollRestoration()
        } else {
          // Keep checking
          setTimeout(checkAndRestore, CHECK_INTERVAL)
        }
      }

      const performScrollRestoration = () => {
        if (!messagesRef || hasRestoredInitialScroll) return

        // Restore saved scroll position
        const savedScrollTop = localStorage.getItem('messagesScrollTop')
        if (savedScrollTop) {
          messagesRef.scrollTop = Number.parseInt(savedScrollTop, 10)
        }

        hasRestoredInitialScroll = true
      }

      // Start checking after initial render
      requestAnimationFrame(() => {
        lastHeight = messagesRef?.scrollHeight || 0
        checkAndRestore()
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
      <div class={styles.messages} ref={messagesRef}>
        {/* Orphaned chapters section removed - chapters are now nodes */}
        <Show when={false}>
          <div class={styles.orphanedChaptersSection}>
            <h3 class={styles.orphanedChaptersTitle}>Orphaned Chapters (missing markers)</h3>
            <For each={[]}>
              {(_chapter) => (
                <div class={styles.orphanedChapterItem}>
                  <div class={styles.orphanedChapterInfo}>
                    <span class={styles.orphanedChapterTitle}>{'Untitled Chapter'}</span>
                    <span class={styles.orphanedChapterId}>ID: {'unknown'}...</span>
                  </div>
                  <div class={styles.orphanedChapterActions}>
                    <button
                      class={styles.createMarkerButton}
                      onClick={() => console.log('Chapters are now nodes')}
                      title="Create marker for this chapter"
                    >
                      Create Marker
                    </button>
                    <button
                      class={styles.deleteOrphanedButton}
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
        />
        <Show when={props.isLoading}>
          <div class={viewStyles.messageWrapper}>
            <div class={styles.loadingMessage}>
              <div class={styles.loadingMessageContent}>Thinking...</div>
            </div>
          </div>
        </Show>
        <Show when={showScrollToTop()}>
          <div class={styles.scrollToTopContainer}>
            <IconButton
              variant="secondary"
              size="md"
              onClick={handleScrollToTop}
              aria-label="Scroll to top"
            >
              <BsChevronUp />
            </IconButton>
          </div>
        </Show>
      </div>
    </>
  )
}
