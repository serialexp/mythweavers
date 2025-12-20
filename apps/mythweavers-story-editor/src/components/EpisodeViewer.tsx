import { Alert, Button, Modal, Select, Spinner, Stack } from '@mythweavers/ui'
import { BsFilm } from 'solid-icons/bs'
import { Component, For, Show, createEffect, createMemo, createSignal, onMount } from 'solid-js'
import * as styles from './EpisodeViewer.css'

interface Episode {
  id: string
  name: string
  filename: string
  frameCount: number
  hasTranscript: boolean
  hasSpeakers: boolean
}

interface EpisodeData {
  id: string
  name: string
  metadata: any
  frames: Array<{
    number: number
    timestamp: number
    imageUrl: string
  }>
  transcript: {
    text: string
    segments: Array<{
      start: number
      end: number
      text: string
      speaker?: string
      words?: Array<{
        start: number
        end: number
        word: string
      }>
    }>
    speakers?: any[]
  }
}

interface EpisodeViewerProps {
  isOpen: boolean
  onClose: () => void
  onInsertDialogue?: (dialogue: string) => void
  mode?: 'modal' | 'docked' // Default is modal
}

// Format timestamp to readable format (MM:SS) - shared utility
const formatTime = (seconds: number) => {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}


// Component to display a segment with video or cycling frames
const SegmentWithFrames: Component<{
  segment: any
  episodeId: string
  useVideo?: boolean
  isSelected?: boolean
  onToggleSelect?: () => void
}> = (props) => {
  const [currentFrameIndex, setCurrentFrameIndex] = createSignal(0)
  const [videoError, setVideoError] = createSignal(false)
  const [videoSrc, setVideoSrc] = createSignal<string | null>(null)

  // Auto-cycle through frames if not using video or if video errored
  createEffect(() => {
    // Skip cycling if we're using video without errors, or if there's only 1 frame
    if ((props.useVideo && !videoError()) || props.segment.frames.length <= 1) return

    // Calculate interval based on segment duration and frame count
    const segmentDuration = (props.segment.end - props.segment.start) * 1000 // Convert to ms
    const intervalMs = segmentDuration / props.segment.frames.length

    // Clamp interval between 100ms (fast) and 2000ms (slow)
    const clampedInterval = Math.max(100, Math.min(2000, intervalMs))

    const interval = setInterval(() => {
      setCurrentFrameIndex((prev) => (prev + 1) % props.segment.frames.length)
    }, clampedInterval)

    return () => clearInterval(interval)
  })

  const currentFrame = () => props.segment.frames[currentFrameIndex()]

  // Get segment index from the segment data
  const segmentIndex = () => {
    const idx = props.segment.segmentIndex
    console.log('Using backend segmentIndex for video URL:', idx, 'from segment:', props.segment)
    return idx
  }

  return (
    <div class={`${styles.segmentItem} ${props.isSelected ? styles.segmentItemSelected : ''}`}>
      <div class={styles.segmentHeader}>
        <Show when={props.onToggleSelect}>
          <input
            type="checkbox"
            class={styles.segmentCheckbox}
            checked={props.isSelected}
            onChange={props.onToggleSelect}
          />
        </Show>
        <div class={styles.segmentTimestamp}>
          <div>
            {formatTime(props.segment.start)} - {formatTime(props.segment.end)}
          </div>
          <Show when={!props.useVideo}>
            <div class={styles.frameInfo}>
              Frame {currentFrame().number}
              <Show when={props.segment.frames.length > 1}>
                <span class={styles.frameInfoFaded}>
                  {' '}
                  ({currentFrameIndex() + 1}/{props.segment.frames.length})
                </span>
              </Show>
            </div>
          </Show>
        </div>
      </div>
      <div class={styles.frameContainer}>
        <Show when={props.useVideo && videoError()}>
          <div class={styles.videoErrorIndicator} title="Video unavailable - showing images instead">
            ⚠️
          </div>
        </Show>
        <Show when={props.useVideo && !videoError()}>
          <video
            src={videoSrc() || undefined}
            class={styles.segmentVideo}
            preload={videoSrc() ? 'metadata' : 'none'}
            loop
            muted
            autoplay
            playsinline
            onError={(e) => {
              if (videoSrc()) {
                console.log('Video not available, falling back to images:', e.currentTarget.src)
                setVideoError(true)
              }
            }}
            onLoadedData={(e) => {
              console.log('Video loaded:', e.currentTarget.src)
              const video = e.currentTarget as HTMLVideoElement
              video.play().catch((err) => {
                console.log('Autoplay failed, trying again:', err)
                setTimeout(() => {
                  video.play().catch((err2) => {
                    console.error('Video play failed:', err2)
                  })
                }, 100)
              })
            }}
            onCanPlay={(e) => {
              const video = e.currentTarget as HTMLVideoElement
              if (video.paused) {
                video.play().catch((err) => {
                  console.log('Play on canplay failed:', err)
                })
              }
            }}
            onLoadStart={(e) => {
              console.log('Video loading started:', e.currentTarget.src)
            }}
            ref={(el) => {
              if (el) {
                const observer = new IntersectionObserver(
                  (entries) => {
                    entries.forEach((entry) => {
                      if (entry.isIntersecting) {
                        if (!videoSrc()) {
                          const src = `/api/episodes/${props.episodeId}/segments/${segmentIndex()}`
                          console.log('Loading video as it enters viewport:', src)
                          setVideoSrc(src)
                        }
                        if (el.paused && videoSrc()) {
                          el.play().catch((err) => {
                            console.log('Play on visibility failed:', err)
                          })
                        }
                      }
                    })
                  },
                  {
                    threshold: 0.1,
                    rootMargin: '200px',
                  },
                )
                observer.observe(el)
              }
            }}
          />
        </Show>
        <Show when={!props.useVideo || videoError()}>
          <img
            src={currentFrame().imageUrl}
            alt={`Frame ${currentFrame().number}`}
            class={styles.frameImage}
            loading="lazy"
          />
          <Show when={props.segment.frames.length > 1}>
            <div class={styles.frameIndicators}>
              <For each={props.segment.frames}>
                {(_, index) => (
                  <button
                    class={`${styles.frameIndicator} ${index() === currentFrameIndex() ? styles.frameIndicatorActive : ''}`}
                    onClick={() => setCurrentFrameIndex(index())}
                  />
                )}
              </For>
            </div>
          </Show>
        </Show>
      </div>
      <div class={styles.transcriptContainer}>
        <div>
          <Show when={props.segment.speaker}>
            <span class={styles.speaker}>{props.segment.speaker}:</span>
          </Show>
          <span class={styles.text}>{props.segment.text}</span>
        </div>
      </div>
    </div>
  )
}

export const EpisodeViewer: Component<EpisodeViewerProps> = (props) => {
  const [episodes, setEpisodes] = createSignal<Episode[]>([])
  const [selectedEpisodeId, setSelectedEpisodeId] = createSignal<string | null>(null)
  const [episodeData, setEpisodeData] = createSignal<EpisodeData | null>(null)
  const [loading, setLoading] = createSignal(false)
  const [error, setError] = createSignal<string | null>(null)
  const [useVideo, setUseVideo] = createSignal(true)
  const [selectedSegments, setSelectedSegments] = createSignal<Set<number>>(new Set())
  const [scrollPositions, setScrollPositions] = createSignal<Map<string, number>>(new Map())
  let contentAreaRef: HTMLDivElement | undefined
  let isRestoringScroll = false

  // Fetch episodes list on mount
  onMount(async () => {
    if (props.isOpen) {
      await fetchEpisodes()
    }
  })

  // Fetch episodes when modal opens
  createEffect(async () => {
    if (props.isOpen && episodes().length === 0) {
      await fetchEpisodes()
    }
  })

  // Save scroll position when modal closes
  createEffect(() => {
    if (!props.isOpen) {
      const currentEpisodeId = selectedEpisodeId()
      if (currentEpisodeId && contentAreaRef) {
        const positions = new Map(scrollPositions())
        positions.set(currentEpisodeId, contentAreaRef.scrollTop)
        setScrollPositions(positions)
      }
    }
  })

  // Restore scroll position when episode data is loaded
  createEffect(() => {
    const data = episodeData()
    const isLoading = loading()
    const episodeId = selectedEpisodeId()

    // Wait for data to be loaded and content to be rendered
    if (data && !isLoading && episodeId && contentAreaRef) {
      // Use requestAnimationFrame to ensure DOM is updated
      requestAnimationFrame(() => {
        setTimeout(() => {
          const savedPosition = scrollPositions().get(episodeId)
          if (savedPosition !== undefined && contentAreaRef) {
            isRestoringScroll = true
            contentAreaRef.scrollTop = savedPosition
            setTimeout(() => {
              isRestoringScroll = false
            }, 100)
          }
        }, 100)
      })
    }
  })

  const fetchEpisodes = async () => {
    try {
      const response = await fetch('/api/episodes')
      if (!response.ok) throw new Error('Failed to fetch episodes')
      const data = await response.json()
      setEpisodes(data)
    } catch (err) {
      console.error('Error fetching episodes:', err)
      setError('Failed to load episodes')
    }
  }

  const handleEpisodeSelect = async (episodeId: string) => {
    if (episodeId === selectedEpisodeId()) return

    // Save current scroll position before switching
    const currentEpisodeId = selectedEpisodeId()
    if (currentEpisodeId && contentAreaRef) {
      const positions = new Map(scrollPositions())
      positions.set(currentEpisodeId, contentAreaRef.scrollTop)
      setScrollPositions(positions)
    }

    setSelectedEpisodeId(episodeId)
    setLoading(true)
    setError(null)
    setSelectedSegments(new Set<number>()) // Clear selections when changing episodes

    try {
      const response = await fetch(`/api/episodes/${episodeId}`)
      if (!response.ok) throw new Error('Failed to fetch episode data')
      const data = await response.json()
      setEpisodeData(data)
    } catch (err) {
      console.error('Error fetching episode:', err)
      setError('Failed to load episode data')
      setEpisodeData(null)
    } finally {
      setLoading(false)
    }
  }

  // Track scroll position changes
  const handleScroll = () => {
    if (isRestoringScroll) return

    const currentEpisodeId = selectedEpisodeId()
    if (currentEpisodeId && contentAreaRef) {
      const positions = new Map(scrollPositions())
      positions.set(currentEpisodeId, contentAreaRef.scrollTop)
      setScrollPositions(positions)
    }
  }

  // Group frames by transcript segments
  const getSegmentsWithFrames = createMemo(() => {
    const data = episodeData()
    if (!data?.transcript?.segments || !data?.frames) return []

    console.log('Episode data:', data)
    console.log('Segments from backend with segmentIndex:', data.transcript.segments)

    // For each segment, find all frames that occur during it
    const segmentsWithFrames = data.transcript.segments
      .map((segment) => {
        const framesInSegment = data.frames!.filter(
          (frame) => frame.timestamp >= segment.start && frame.timestamp <= segment.end,
        )

        // If no frames directly in segment, find the closest frame
        if (framesInSegment.length === 0) {
          const closestFrame = data.frames!.reduce((prev, curr) => {
            const prevDist = Math.abs(prev.timestamp - segment.start)
            const currDist = Math.abs(curr.timestamp - segment.start)
            return currDist < prevDist ? curr : prev
          })
          framesInSegment.push(closestFrame)
        }

        return {
          ...segment,
          frames: framesInSegment,
          // segmentIndex should already be in the segment from backend
        }
      })
      .filter((seg) => seg.frames.length > 0)

    console.log('Segments with frames (after filtering):', segmentsWithFrames)
    return segmentsWithFrames
  })

  // Scroll to percentage of content area
  const scrollToPosition = (percentage: number) => {
    if (contentAreaRef) {
      const maxScroll = contentAreaRef.scrollHeight - contentAreaRef.clientHeight
      const targetScroll = maxScroll * (percentage / 100)
      contentAreaRef.scrollTo({
        top: targetScroll,
        behavior: 'smooth',
      })
    }
  }

  // Toggle segment selection
  const toggleSegmentSelection = (index: number) => {
    const current = selectedSegments()
    const newSet = new Set(current)
    if (newSet.has(index)) {
      newSet.delete(index)
    } else {
      newSet.add(index)
    }
    setSelectedSegments(newSet)
  }

  // Insert selected dialogue into instructions
  const insertSelectedDialogue = async () => {
    const segments = getSegmentsWithFrames()
    const selected = Array.from(selectedSegments())
      .sort((a, b) => a - b)
      .map((idx) => segments[idx])
      .filter((seg) => seg)

    if (selected.length === 0) return

    // Format the dialogue with quotes and double newlines
    const dialogueText = selected
      .map((seg) => {
        const speaker = seg.speaker ? `${seg.speaker}: ` : ''
        return `"${speaker}${seg.text}"`
      })
      .join('\n\n')

    // Call the callback if provided
    if (props.onInsertDialogue) {
      props.onInsertDialogue(dialogueText)
    }

    // Also update the messagesStore input directly
    const { messagesStore } = await import('../stores/messagesStore')
    const currentInput = messagesStore.input
    const newInput = currentInput ? `${currentInput}\n\n${dialogueText}` : dialogueText
    messagesStore.setInput(newInput)

    // Clear selections and close modal
    setSelectedSegments(new Set<number>())
    props.onClose()
  }

  const mode = props.mode || 'modal'

  const innerContent = (
    <>
      <div class={styles.episodeSelector}>
        <span class={styles.episodeSelectorLabel}>Select Episode:</span>
        <Select
          value={selectedEpisodeId() || ''}
          onChange={(e) => handleEpisodeSelect(e.target.value)}
          disabled={loading()}
          options={[
            { value: '', label: 'Choose an episode...' },
            ...episodes().map((episode) => ({
              value: episode.id,
              label: `${episode.name}${episode.hasTranscript ? ' 📝' : ''}${episode.hasSpeakers ? ' 👥' : ''}`,
            })),
          ]}
          style={{ flex: '1', 'min-width': '200px', 'max-width': '400px' }}
        />

        <Show when={selectedEpisodeId()}>
          <Button
            variant="primary"
            size="sm"
            onClick={() => setUseVideo(!useVideo())}
            title={useVideo() ? 'Switch to Image Mode' : 'Switch to Video Mode'}
          >
            {useVideo() ? '🎬 Video Mode' : '🖼️ Image Mode'}
          </Button>
        </Show>

        <Show when={episodeData() && !loading()}>
          <div class={styles.scrollButtons}>
            <Button variant="secondary" size="sm" onClick={() => scrollToPosition(0)} title="Scroll to top">
              ↑ Top
            </Button>
            <Button variant="secondary" size="sm" onClick={() => scrollToPosition(25)} title="Scroll to 25%">
              25%
            </Button>
            <Button variant="secondary" size="sm" onClick={() => scrollToPosition(50)} title="Scroll to 50%">
              50%
            </Button>
            <Button variant="secondary" size="sm" onClick={() => scrollToPosition(75)} title="Scroll to 75%">
              75%
            </Button>
            <Button variant="secondary" size="sm" onClick={() => scrollToPosition(100)} title="Scroll to bottom">
              ↓ Bottom
            </Button>
          </div>
        </Show>
      </div>

      <Show when={selectedSegments().size > 0}>
        <div class={styles.selectionBar}>
          <span class={styles.selectionCount}>
            {selectedSegments().size} segment{selectedSegments().size !== 1 ? 's' : ''} selected
          </span>
          <Button
            variant="primary"
            size="sm"
            onClick={insertSelectedDialogue}
            title="Insert selected dialogue into instructions"
          >
            ↓ Insert into Instructions
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setSelectedSegments(new Set<number>())}
            title="Clear selection"
          >
            Clear
          </Button>
        </div>
      </Show>

      <div class={styles.contentArea} ref={contentAreaRef} onScroll={handleScroll}>
        <Show when={loading()}>
          <Stack gap="md" class={styles.loadingContainer}>
            <Spinner size="lg" />
            <span class={styles.loadingText}>Loading episode data...</span>
          </Stack>
        </Show>

        <Show when={error()}>
          <Alert variant="error">{error()}</Alert>
        </Show>

        <Show when={episodeData() && !loading()}>
          <div class={styles.timeline}>
            <For each={getSegmentsWithFrames()}>
              {(segment, index) => (
                <SegmentWithFrames
                  segment={segment}
                  episodeId={selectedEpisodeId()!}
                  useVideo={useVideo()}
                  isSelected={selectedSegments().has(index())}
                  onToggleSelect={() => toggleSegmentSelection(index())}
                />
              )}
            </For>
          </div>
        </Show>
      </div>
    </>
  )

  // Docked mode - just renders inline
  if (mode === 'docked') {
    return (
      <Show when={props.isOpen}>
        <div class={styles.dockedContent}>
          <div class={styles.header}>
            <h2 class={styles.headerTitle}>
              <BsFilm /> Episode Viewer
            </h2>
          </div>
          {innerContent}
        </div>
      </Show>
    )
  }

  // Modal mode - uses Modal component
  return (
    <Modal
      open={props.isOpen}
      onClose={props.onClose}
      title={
        <>
          <BsFilm /> Episode Viewer
        </>
      }
      size="xl"
    >
      {innerContent}
    </Modal>
  )
}
