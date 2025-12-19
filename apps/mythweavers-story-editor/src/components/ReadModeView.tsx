import { Component, For, createEffect, createMemo, createSignal, onCleanup, onMount } from 'solid-js'
import { nodeStore } from '../stores/nodeStore'
import { createDisplayMessagesMemo } from '../utils/messageFiltering'
import * as styles from './ReadModeView.css'

interface Page {
  paragraphs: Array<{ text: string; isFirstInMessage: boolean }>
  measurerParagraphs: Array<{ text: string; isFirstInMessage: boolean }>
  startIndex: number
  endIndex: number
  hasOverflowForDebugging: boolean
  availableHeight: number
}

interface ReadModeViewProps {
  isGenerating: boolean
}

export const ReadModeView: Component<ReadModeViewProps> = (_props) => {
  let containerRef: HTMLDivElement | undefined
  let readingAreaRef: HTMLDivElement | undefined

  const [currentPageIndex, setCurrentPageIndex] = createSignal(0)
  const displayMessages = createDisplayMessagesMemo()

  // Get current selected node reactively
  const selectedNode = createMemo(() => nodeStore.getSelectedNode())

  // Filter to only story content
  const storyContent = createMemo(() => {
    return displayMessages().filter(
      (msg) => msg.role === 'assistant' && !msg.isQuery && msg.type !== 'event' && msg.type !== 'chapter',
    )
  })

  // Extract all sentences from story content with message and paragraph boundaries
  const allSentences = createMemo(() => {
    const messages = storyContent()
    if (messages.length === 0) return []

    const sentencesWithInfo: Array<{
      text: string
      isFirstInMessage: boolean
      isFirstInParagraph: boolean
    }> = []

    messages.forEach((msg) => {
      const paragraphs = msg.content
        .split(/\n\n+/)
        .filter((p) => p.trim().length > 0)
        .map((p) => p.trim())

      paragraphs.forEach((para, paraIndex) => {
        // Split paragraph into sentences
        const sentences = para
          .split(/(?<=[.!?])\s+/)
          .filter((s) => s.trim().length > 0)
          .map((s) => s.trim())

        sentences.forEach((sentence, sentIndex) => {
          sentencesWithInfo.push({
            text: sentence,
            isFirstInMessage: paraIndex === 0 && sentIndex === 0,
            isFirstInParagraph: sentIndex === 0,
          })
        })
      })
    })

    return sentencesWithInfo
  })

  // Store pages in a signal so we can update them after DOM renders
  const [pages, setPages] = createSignal<Page[]>([])

  // Track the height we're currently using for calculations
  const [currentCalculationHeight, setCurrentCalculationHeight] = createSignal<number>(0)

  // Calculate pages based on container dimensions
  const calculatePages = () => {
    const sentences = allSentences()
    if (sentences.length === 0) return []
    if (!readingAreaRef) return []

    console.log('[ReadMode] ===== PAGINATION RECALCULATION TRIGGERED =====')

    const originalReadingAreaHeight = readingAreaRef.offsetWidth
    const readingAreaWidth = readingAreaRef.offsetHeight
    console.log('readingareaheight', originalReadingAreaHeight, currentCalculationHeight())

    // Use container width minus some padding for content area
    let actualContentWidth = Math.max(200, readingAreaWidth - 32) // 16px padding on each side, minimum 200px
    const existingPageContentForWidth = readingAreaRef?.querySelector(`.${styles.pageContent}`) as HTMLElement
    if (existingPageContentForWidth) {
      actualContentWidth = existingPageContentForWidth.offsetWidth
    }

    const readingAreaHeight = currentCalculationHeight() ?? originalReadingAreaHeight
    const availableHeight = readingAreaHeight - 48

    console.log('[ReadMode] Using available height:', availableHeight)

    // Clean up any existing measurers first
    const existingMeasurers = document.querySelectorAll('[data-readmode-measurer]')
    existingMeasurers.forEach((el) => el.remove())

    // Create hidden measuring div positioned in document body but with exact dimensions
    const measurer = document.createElement('div')
    measurer.className = styles.pageContent
    measurer.style.cssText = `
      position: absolute;
      top: -10000px;
      left: -10000px;
      width: ${actualContentWidth}px;
      height: auto;
      max-height: ${availableHeight}px;
      visibility: hidden;
    `
    readingAreaRef.appendChild(measurer)

    const calculatedPages: Page[] = []
    let currentPageSentences: Array<{
      text: string
      isFirstInMessage: boolean
      isFirstInParagraph: boolean
    }> = []
    let startIndex = 0

    sentences.forEach((sentenceInfo, index) => {
      // Always start a new page for the first sentence of a new message
      const shouldStartNewPage = sentenceInfo.isFirstInMessage && currentPageSentences.length > 0

      if (shouldStartNewPage) {
        // Save current page before starting new message
        const pagesParagraphs = groupSentencesIntoParagraphs(currentPageSentences)

        // Try to show shadow of the next sentence (which starts a new message) in measurer
        const measurerParagraphs = groupSentencesIntoParagraphs([...currentPageSentences, sentenceInfo])

        calculatedPages.push({
          paragraphs: pagesParagraphs,
          measurerParagraphs: measurerParagraphs, // Show next sentence shadow in measurer
          startIndex,
          endIndex: index - 1,
          hasOverflowForDebugging: true, // Show that we have next content in measurer
          availableHeight: availableHeight,
        })

        // Start fresh page for new message
        currentPageSentences = []
        startIndex = index
      }

      // Add sentence to test content
      const testSentences = [...currentPageSentences, sentenceInfo]
      const testParagraphs = groupSentencesIntoParagraphs(testSentences)

      // Clear and rebuild content for measurement
      measurer.innerHTML = ''

      // Add chapter title on first page (only when we're building the first page)
      if (calculatedPages.length === 0) {
        const titleElement = document.createElement('h1')
        titleElement.className = styles.chapterTitle
        // Use nodeStore.getSelectedNode() directly to avoid reactivity
        titleElement.textContent = nodeStore.getSelectedNode()?.title || ''
        measurer.appendChild(titleElement)
      }

      testParagraphs.forEach((para) => {
        const paraElement = document.createElement('p')

        if (para.isFirstInMessage) {
          paraElement.className = `${styles.paragraph} ${styles.firstParagraph}`
        } else {
          paraElement.className = styles.paragraph
        }

        paraElement.textContent = para.text
        measurer.appendChild(paraElement)
      })

      const newHeight = measurer.scrollHeight

      // Check if adding this sentence exceeds available height (but not for message breaks)
      if (newHeight > availableHeight && currentPageSentences.length > 0 && !shouldStartNewPage) {
        // Save current page (visible content without overflow, but measurer shows the overflow sentence)
        const visibleParagraphs = groupSentencesIntoParagraphs(currentPageSentences)
        const measurerParagraphs = groupSentencesIntoParagraphs([...currentPageSentences, sentenceInfo])

        calculatedPages.push({
          paragraphs: visibleParagraphs,
          measurerParagraphs: measurerParagraphs, // Show overflow sentence in measurer
          startIndex,
          endIndex: index - 1,
          hasOverflowForDebugging: true,
          availableHeight: availableHeight,
        })

        // Start new page with the overflow sentence
        currentPageSentences = [sentenceInfo]
        startIndex = index
      } else {
        currentPageSentences.push(sentenceInfo)
      }
    })

    // Helper function to group sentences back into paragraphs
    function groupSentencesIntoParagraphs(
      sentences: Array<{
        text: string
        isFirstInMessage: boolean
        isFirstInParagraph: boolean
      }>,
    ): Array<{ text: string; isFirstInMessage: boolean }> {
      const paragraphs: Array<{ text: string; isFirstInMessage: boolean }> = []
      let currentParagraph = ''
      let currentIsFirstInMessage = false

      sentences.forEach((sentence) => {
        if (sentence.isFirstInParagraph && currentParagraph) {
          // Save previous paragraph
          paragraphs.push({
            text: currentParagraph,
            isFirstInMessage: currentIsFirstInMessage,
          })
          currentParagraph = sentence.text
          currentIsFirstInMessage = sentence.isFirstInMessage
        } else if (sentence.isFirstInParagraph) {
          // First sentence of first paragraph
          currentParagraph = sentence.text
          currentIsFirstInMessage = sentence.isFirstInMessage
        } else {
          // Add to current paragraph
          currentParagraph += ` ${sentence.text}`
        }
      })

      // Add final paragraph
      if (currentParagraph) {
        paragraphs.push({
          text: currentParagraph,
          isFirstInMessage: currentIsFirstInMessage,
        })
      }

      return paragraphs
    }

    // Add remaining sentences as final page - try to show shadow of next sentence if this isn't the last page
    if (currentPageSentences.length > 0) {
      const finalParagraphs = groupSentencesIntoParagraphs(currentPageSentences)

      // Try to peek ahead one sentence to show in measurer (if available and not starting new message)
      const currentEndIndex = startIndex + currentPageSentences.length - 1
      const nextSentence = sentences[currentEndIndex + 1]
      const canShowNextSentence = nextSentence && !nextSentence.isFirstInMessage

      const measurerParagraphs = canShowNextSentence
        ? groupSentencesIntoParagraphs([...currentPageSentences, nextSentence])
        : finalParagraphs

      calculatedPages.push({
        paragraphs: finalParagraphs,
        measurerParagraphs: measurerParagraphs,
        startIndex,
        endIndex: currentEndIndex,
        hasOverflowForDebugging: canShowNextSentence,
        availableHeight: availableHeight,
      })
    }

    // Keep the measurer for visual debugging - we'll reposition it later
    measurer.setAttribute('data-readmode-measurer', 'true')

    return calculatedPages
  }

  // Initial calculation and recurring height monitor
  let heightCheckTimer: number

  function checkAndRecalculate() {
    if (!readingAreaRef) return

    // Get the readingArea element's fixed height (it's flex: 1 so height is consistent)
    const readingAreaElement = document.querySelector(`.${styles.readingArea}`) as HTMLElement

    const height = currentCalculationHeight()

    if (readingAreaElement && height !== readingAreaElement.offsetHeight) {
      console.log(
        `[ReadMode] Found readingArea element ${height} ${readingAreaElement.offsetHeight}, performing  calculation`,
      )
      setCurrentCalculationHeight(readingAreaElement.offsetHeight)
      const newPages = calculatePages()
      setPages(newPages)
    } else if (!readingAreaElement) {
      console.log(`[ReadMode] readingArea element with class ${styles.readingArea} not found yet, will retry...`)
    }
  }

  // Set up recurring check every 100ms
  heightCheckTimer = window.setInterval(checkAndRecalculate, 1000)

  // Reset to first page when pages change
  createEffect(() => {
    const allPages = pages()
    if (!allPages) return
    const pageCount = allPages.length
    if (pageCount > 0 && currentPageIndex() >= pageCount) {
      setCurrentPageIndex(0)
    }
  })

  // Navigate to previous page
  const goToPrevPage = (e?: MouseEvent) => {
    e?.preventDefault()
    if (currentPageIndex() > 0) {
      setCurrentPageIndex(currentPageIndex() - 1)
    }
  }

  // Navigate to next page
  const goToNextPage = (e?: MouseEvent) => {
    e?.preventDefault()
    const allPages = pages()
    if (allPages.length && currentPageIndex() < allPages.length - 1) {
      setCurrentPageIndex(currentPageIndex() + 1)
    }
  }

  // Keyboard navigation
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'ArrowLeft') {
      goToPrevPage()
    } else if (e.key === 'ArrowRight') {
      goToNextPage()
    }
  }

  // Handle window resize
  let resizeTimeout: number
  const handleResize = () => {
    clearTimeout(resizeTimeout)
    resizeTimeout = window.setTimeout(() => {
      // Reset to a valid page if current page is out of bounds
      const currentPageIdx = currentPageIndex()
      const allPages = pages()
      if (allPages.length) {
        const newPageCount = allPages.length
        if (currentPageIdx >= newPageCount && newPageCount > 0) {
          setCurrentPageIndex(Math.min(currentPageIdx, newPageCount - 1))
        }
      }
    }, 150)
  }

  onMount(() => {
    document.addEventListener('keydown', handleKeyDown)
    window.addEventListener('resize', handleResize)
  })

  // Reposition the measurer over the actual pageContent after it renders
  createEffect(() => {
    // Access currentPage to make this reactive
    const page = currentPage()
    console.log('[ReadMode] Effect triggered, page:', !!page, 'readingAreaRef:', !!readingAreaRef)

    if (!page || !readingAreaRef) return

    // Small delay to let DOM update
    setTimeout(() => {
      const measurer = document.querySelector('[data-readmode-measurer]') as HTMLElement
      const pageContentElement = readingAreaRef.querySelector(`.${styles.pageContent}`) as HTMLElement

      console.log('[ReadMode] Elements found - measurer:', !!measurer, 'pageContent:', !!pageContentElement)

      if (!measurer || !pageContentElement) return

      // Update measurer content to match the current page
      measurer.innerHTML = ''

      // Add chapter title on first page
      if (currentPageIndex() === 0 && selectedNode()) {
        const titleElement = document.createElement('h1')
        titleElement.className = styles.chapterTitle
        titleElement.textContent = selectedNode()!.title
        measurer.appendChild(titleElement)
      }

      // Add current page paragraphs (use measurerParagraphs to show overflow)
      const sentenceBreakpoints: Array<{
        sentence: number
        height: number
        isVisible: boolean
      }> = []
      let totalSentenceCount = 0

      page.measurerParagraphs.forEach((para) => {
        const paraElement = document.createElement('p')

        if (para.isFirstInMessage) {
          paraElement.className = `${styles.paragraph} ${styles.firstParagraph}`
        } else {
          paraElement.className = styles.paragraph
        }

        // Split paragraph into sentences for individual tracking
        const sentences = para.text.split(/(?<=[.!?])\s+/).filter((s) => s.trim().length > 0)

        sentences.forEach((sentence, sentIndex) => {
          totalSentenceCount++
          const isLastSentenceInPara = sentIndex === sentences.length - 1

          // Create individual sentence spans for precise measurement
          const sentenceSpan = document.createElement('span')
          sentenceSpan.textContent = sentence + (isLastSentenceInPara ? '' : ' ')
          sentenceSpan.style.position = 'relative'

          paraElement.appendChild(sentenceSpan)
        })

        measurer.appendChild(paraElement)

        // Count total sentences in this paragraph and log the breakpoint
        const paraHeight = paraElement.offsetTop + paraElement.offsetHeight

        sentenceBreakpoints.push({
          sentence: totalSentenceCount,
          height: paraHeight,
          isVisible: paraHeight <= page.availableHeight, // Compare against the same height used for pagination
        })
      })

      // Log sentence breakpoints for debugging
      console.log(`[ReadMode] Page ${currentPageIndex() + 1} sentence breakpoints:`, sentenceBreakpoints)
      console.log(
        `[ReadMode] Total visible sentences: ${page.paragraphs.reduce((count, p) => count + p.text.split(/(?<=[.!?])\s+/).filter((s) => s.trim().length > 0).length, 0)}`,
      )
      console.log(`[ReadMode] Total measurer sentences: ${totalSentenceCount}`)
      console.log(`[ReadMode] Available height used for pagination: ${page.availableHeight}px`)
      console.log(`[ReadMode] Measurer actual height: ${measurer.offsetHeight}px`)

      const targetRect = pageContentElement.getBoundingClientRect()

      if (false) {
        // Apply the same class as pageContent and add positioning styles
        measurer.style.position = 'fixed'
        measurer.style.top = `${targetRect.top}px`
        measurer.style.left = `${targetRect.left}px`
        measurer.style.width = `${targetRect.width}px`
        measurer.style.opacity = '0.4'
        measurer.style.background = 'rgba(255, 0, 0, 0.1)'
        measurer.style.zIndex = '1000'
        measurer.style.pointerEvents = 'none'
        measurer.style.visibility = 'visible'
      }
    }, 50)
  })

  onCleanup(() => {
    document.removeEventListener('keydown', handleKeyDown)
    window.removeEventListener('resize', handleResize)
    clearTimeout(resizeTimeout)
    if (heightCheckTimer) {
      clearInterval(heightCheckTimer)
    }
  })

  const currentPage = createMemo(() => {
    const allPages = pages()
    if (!allPages.length) return null
    const index = currentPageIndex()
    return allPages[index] || null
  })

  return (
    <div class={styles.container} ref={containerRef}>
      <div class={styles.readingArea} ref={readingAreaRef}>
        <div class={styles.pageContent}>
          {/* Show chapter title on first page */}
          {currentPageIndex() === 0 && selectedNode() && <h1 class={styles.chapterTitle}>{selectedNode()!.title}</h1>}

          {currentPage() ? (
            <For each={currentPage()!.paragraphs}>
              {(paragraphInfo) => (
                <p class={`${styles.paragraph} ${paragraphInfo.isFirstInMessage ? styles.firstParagraph : ''}`}>
                  {paragraphInfo.text}
                </p>
              )}
            </For>
          ) : (
            <div class={styles.emptyState}>
              {storyContent().length === 0 ? <p>No story content in this chapter yet.</p> : <p>Loading...</p>}
            </div>
          )}
        </div>

        {/* Click zones for navigation */}
        <div class={styles.prevZone} onClick={goToPrevPage} />
        <div class={styles.nextZone} onClick={goToNextPage} />
      </div>

      <div class={styles.pageIndicator}>{pages().length ? `${currentPageIndex() + 1} / ${pages().length}` : ''}</div>
    </div>
  )
}
