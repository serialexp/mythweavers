import { useNavigate } from '@solidjs/router'
import { Dropdown, DropdownItem } from '@mythweavers/ui'
import { Component, For, Show, createEffect, createMemo, createSignal, onCleanup, onMount } from 'solid-js'
import { useOllama } from '../hooks/useOllama'
import { cacheStore } from '../stores/cacheStore'
import { copyPreviewStore } from '../stores/copyPreviewStore'
import { currentStoryStore } from '../stores/currentStoryStore'
import { messagesStore } from '../stores/messagesStore'
import { modelsStore } from '../stores/modelsStore'
import { navigationStore } from '../stores/navigationStore'
import { TreeNode, nodeStore } from '../stores/nodeStore'
import { scriptDataStore } from '../stores/scriptDataStore'
import { effectiveSettings } from '../stores/effectiveSettingsStore'
import { settingsStore } from '../stores/settingsStore'
import { statsStore } from '../stores/statsStore'
import { Node, NodeType } from '../types/core'
import { buildNodeMarkdown, buildPrecedingContextMarkdown, buildTreeMarkdown } from '../utils/nodeContentExport'
import { getContextNodesFingerprint } from '../utils/storyFingerprint'
import { estimateTokensFromText } from '../utils/templateAI'
import { createAnthropicClient } from '../utils/anthropicClient'
import { BackgroundOptionsModal } from './BackgroundOptionsModal'
import { ChapterPublishingModal } from './ChapterPublishingModal'
import { BookDetailsModal } from './BookDetailsModal'
import { CharacterUpdateModal } from './CharacterUpdateModal'
import { StoryDetailsModal } from './StoryDetailsModal'
import { ContextItemGenerateModal } from './ContextItemGenerateModal'
import { NodeStatusMenu } from './NodeStatusMenu'
import { PublishingBadge } from './PublishingBadge'
import { SplitSceneModal } from './SplitSceneModal'
import { RoyalRoadPublishingPanel } from './RoyalRoadPublishingPanel'
import { StoryPublishingModal } from './StoryPublishingModal'
import * as styles from './StoryNavigation.css'
import { DropPosition, TreeDragDropProvider, useTreeDragDrop } from './TreeDragDropContext'
import { PhArrowCounterClockwiseIcon, PhArrowDownIcon, PhArrowUpIcon, PhBookIcon, PhBookOpenIcon, PhCaretDownIcon, PhCaretRightIcon, PhCheckCircleIcon, PhCircleHalfIcon, PhCircleIcon, PhClockIcon, PhCodeIcon, PhDotsThreeIcon, PhFileTextIcon, PhFloppyDiskIcon, PhGlobeIcon, PhImageIcon, PhInfoIcon, PhPencilSimpleIcon, PhPlusCircleIcon, PhScissorsIcon, PhSignOutIcon, PhTrashIcon, PhTreeStructureIcon, PhUsersIcon, PhWarningIcon } from 'solidjs-phosphor'

interface NodeItemProps {
  treeNode: TreeNode
  level: number
  onSelectChapter?: () => void
  onSplitScene?: (nodeId: string) => void
  onExtractBook?: (bookId: string) => void
  onPublishChapter?: (chapterId: string) => void
  onOpenBookDetails?: (bookId: string) => void
  onOpenBackgroundOptions?: (nodeId: string) => void
}

const getAllowedParentType = (type: NodeType): NodeType | null => {
  switch (type) {
    case 'book':
      return null
    case 'arc':
      return 'book'
    case 'chapter':
      return 'arc'
    case 'scene':
      return 'chapter'
    default:
      return null
  }
}

const isAncestor = (maybeAncestorId: string, nodeId: string): boolean => {
  let current: Node | undefined = nodeStore.nodes[nodeId]
  while (current?.parentId) {
    if (current.parentId === maybeAncestorId) {
      return true
    }
    current = nodeStore.nodes[current.parentId]
  }
  return false
}

const canDropInsideNode = (target: Node, dragging: Node): boolean => {
  const expectedParentType = getAllowedParentType(dragging.type)
  if (!expectedParentType) return false
  if (target.type !== expectedParentType) return false
  if (target.id === dragging.id) return false
  if (isAncestor(dragging.id, target.id)) return false
  return true
}

const canDropAsSibling = (targetParentId: string | null, dragging: Node): boolean => {
  const expectedParentType = getAllowedParentType(dragging.type)
  if (targetParentId === null) {
    return expectedParentType === null
  }
  if (!expectedParentType) return false
  if (targetParentId === dragging.id) return false
  if (isAncestor(dragging.id, targetParentId)) return false
  const parentNode = nodeStore.nodes[targetParentId]
  if (!parentNode) return false
  return parentNode.type === expectedParentType
}

const getSortedSiblings = (parentId: string | null, excludeIds: string[] = []): Node[] => {
  const excludeSet = new Set(excludeIds)
  const nodes = Object.values(nodeStore.nodes)
  return nodes
    .filter((n) => (parentId === null ? n.parentId == null : n.parentId === parentId))
    .filter((n) => !excludeSet.has(n.id))
    .sort((a, b) => a.order - b.order)
}

const getTreeOrderMap = (): Map<string, number> => {
  const orderMap = new Map<string, number>()
  let counter = 0

  const traverse = (treeNodes: TreeNode[]) => {
    for (let i = 0; i < treeNodes.length; i++) {
      const treeNode = treeNodes[i]
      orderMap.set(treeNode.id, counter++)
      if (treeNode.children.length > 0) {
        traverse(treeNode.children)
      }
    }
  }

  traverse(nodeStore.tree)
  return orderMap
}

const orderIdsByTree = (ids: string[]): string[] => {
  const orderMap = getTreeOrderMap()
  return [...ids].sort((a, b) => {
    const orderA = orderMap.get(a) ?? Number.MAX_SAFE_INTEGER
    const orderB = orderMap.get(b) ?? Number.MAX_SAFE_INTEGER
    return orderA - orderB
  })
}

const canDropInsideNodes = (target: Node, draggingNodes: Node[]): boolean => {
  return draggingNodes.every((dragNode) => canDropInsideNode(target, dragNode))
}

const canDropAsSiblingNodes = (targetParentId: string | null, draggingNodes: Node[]): boolean => {
  return draggingNodes.every((dragNode) => canDropAsSibling(targetParentId, dragNode))
}

const getTypeLabel = (type: NodeType, count: number): string => {
  switch (type) {
    case 'book':
      return count === 1 ? 'book' : 'books'
    case 'arc':
      return count === 1 ? 'arc' : 'arcs'
    case 'chapter':
      return count === 1 ? 'chapter' : 'chapters'
    case 'scene':
      return count === 1 ? 'scene' : 'scenes'
    default:
      return count === 1 ? 'node' : 'nodes'
  }
}

const NodeItem: Component<NodeItemProps> = (props) => {
  const {
    draggingIds,
    dropTarget,
    selectedIds,
    startDrag,
    setSelection,
    toggleSelection,
    clearSelection,
    setDropTarget,
    endDrag,
  } = useTreeDragDrop()
  const [isEditing, setIsEditing] = createSignal(false)
  let dragPreviewEl: HTMLDivElement | null = null
  let editInputRef: HTMLInputElement | undefined

  // Get the Ollama hook for summary and title generation
  const { generateNodeSummary, generateNodeTitle } = useOllama()
  const [isGeneratingTitle, setIsGeneratingTitle] = createSignal(false)

  // Get the reactive node directly from store hash map
  const node = () => nodeStore.nodes[props.treeNode.id]

  const [editTitle, setEditTitle] = createSignal(node()?.title || '')
  const isDragging = () => draggingIds().includes(props.treeNode.id)
  const isMultiSelected = () => selectedIds().includes(props.treeNode.id)
  const isDropTarget = () => dropTarget()?.nodeId === props.treeNode.id
  const dropPosition = () => dropTarget()?.position

  // A chapter with exactly one scene renders as a single row: the chapter's
  // title with the scene's content controls folded in. The scene node still
  // exists and is still what gets selected — it just doesn't get its own row
  // until the chapter has more than one.
  const mergedSceneId = (): string | null => {
    const n = node()
    if (!n || n.type !== 'chapter') return null
    if (props.treeNode.children.length !== 1) return null
    const child = nodeStore.nodes[props.treeNode.children[0].id]
    return child?.type === 'scene' ? child.id : null
  }

  // The node holding this row's actual content: the merged scene when
  // collapsed, otherwise the row's own node.
  const contentNodeId = () => mergedSceneId() ?? props.treeNode.id
  const contentNode = () => nodeStore.nodes[contentNodeId()]

  // Direct child count, shown on container rows so the shape of the tree is
  // readable without expanding everything. A merged single-scene chapter has
  // a count of 1, so it stays hidden there too.
  const childCount = () => (node()?.type === 'scene' ? 0 : props.treeNode.children.length)

  const childCountLabel = () => {
    const firstChild = nodeStore.nodes[props.treeNode.children[0]?.id]
    if (!firstChild) return ''
    return `${childCount()} ${getTypeLabel(firstChild.type, childCount())}`
  }

  const isExpanded = () => nodeStore.isExpanded(props.treeNode.id)
  const isSelected = () => nodeStore.selectedNodeId === contentNodeId()
  const hasChildren = () => props.treeNode.children.length > 0 && !mergedSceneId()
  const isActive = () => messagesStore.isNodeActive(contentNodeId())

  // Check if this chapter has script changes
  const hasScriptChanges = () => {
    const n = node()
    if (!n || n.type !== 'chapter') return false
    const nodeChanges = scriptDataStore.getNodeChanges(props.treeNode.id)
    return nodeChanges && nodeChanges.changes.length > 0
  }

  // Get a tooltip for script changes
  const getScriptChangesTooltip = () => {
    if (!hasScriptChanges()) return ''
    const nodeChanges = scriptDataStore.getNodeChanges(props.treeNode.id)
    if (!nodeChanges) return ''
    return `Script changes: ${nodeChanges.changes.map((c) => c.key).join(', ')}`
  }

  // Check if this node has script errors
  const hasScriptErrors = () => {
    return scriptDataStore.hasScriptErrors(props.treeNode.id)
  }

  // Get a tooltip for script errors
  const getScriptErrorsTooltip = () => {
    const errors = scriptDataStore.getScriptErrors(props.treeNode.id)
    if (errors.length === 0) return ''
    if (errors.length === 1) {
      return `Script error: ${errors[0].error}`
    }
    return `${errors.length} script errors:\n${errors.map((e) => `• ${e.error}`).join('\n')}`
  }

  // Check if scene has content but no summary
  const needsSummary = () => {
    const n = contentNode()
    if (!n || (n.type !== 'chapter' && n.type !== 'scene')) return false

    // Check if node has a summary
    const summary = n.summary
    if (summary && summary.trim().length > 0) return false

    // Check if scene has any messages with content
    const sceneMessages = messagesStore.messages.filter(
      (msg) =>
        msg.sceneId === contentNodeId() &&
        msg.role === 'assistant' &&
        !msg.isQuery &&
        msg.content &&
        msg.content.trim().length > 0,
    )

    return sceneMessages.length > 0
  }

  // Which Snowflake summary levels this node has. L1/L2 come from outlining or
  // from a summary pass (which now fills all three); L3 is the canonical
  // `summary`. Reads the merged scene for a collapsed single-scene chapter.
  const summaryLevels = () => {
    const n = contentNode()
    return [
      { label: 'L1', filled: !!n?.sentenceSummary?.trim(), name: 'one-sentence' },
      { label: 'L2', filled: !!n?.paragraphSummary?.trim(), name: 'paragraph' },
      { label: 'L3', filled: !!n?.summary?.trim(), name: 'full' },
    ]
  }

  // Nothing to show for a node that has never been summarized — the amber
  // warning already covers "has content but no summary".
  const hasAnySummaryLevel = () => summaryLevels().some((level) => level.filled)

  const summaryLevelsTooltip = () =>
    summaryLevels()
      .map((level) => `${level.label} ${level.name}: ${level.filled ? 'yes' : 'no'}`)
      .join('\n')

  // Check if scene has any branch messages
  const hasBranches = () => {
    const n = contentNode()
    if (!n || n.type !== 'scene') return false

    // Use pre-computed Set for O(1) lookup instead of filtering all messages
    return messagesStore.hasNodeBranches(contentNodeId())
  }

  // Check if scene is missing a storyTime
  const needsStoryTime = () => {
    const n = contentNode()
    if (!n || n.type !== 'scene') return false
    return n.storyTime === undefined || n.storyTime === null
  }

  // Check if scene matches the active storyline filter
  const matchesStorylineFilter = () => {
    const selectedId = navigationStore.selectedStorylineId
    if (!selectedId) return false // No filter active

    const n = contentNode()
    if (!n || n.type !== 'scene') return false

    return (n.activeContextItemIds || []).includes(selectedId)
  }

  // Get word count for this scene (pre-calculated by backend)
  const wordCount = () => {
    const n = contentNode()
    if (!n || n.type !== 'scene') return 0
    return n.wordCount || 0
  }

  // Determine color based on word count relative to average
  const getWordCountColor = () => {
    const n = contentNode()
    if (!n || n.type !== 'scene') return undefined
    const count = wordCount()
    if (count === 0) return '#6b7280' // gray for empty scenes

    const stats = statsStore.wordCountStats
    if (stats.average === 0) return '#22c55e' // green if no baseline

    const ratio = count / stats.average

    if (ratio >= 1.5) return '#ef4444' // red for very long scenes
    if (ratio >= 1.0) return '#f97316' // orange for above average
    if (ratio >= 0.5) return '#eab308' // yellow for average
    return '#22c55e' // green for short scenes
  }

  // Get the icon based on includeInFull state
  const getIncludeIcon = () => {
    const n = contentNode()
    const includeVal = n?.includeInFull ?? 2 // default to full content
    switch (includeVal) {
      case 0:
        return <PhCircleIcon /> // Not included
      case 1:
        return <PhCircleHalfIcon weight="fill" /> // Summary only
      case 2:
        return <PhCheckCircleIcon weight="fill" /> // Full content
      default:
        return <PhCircleHalfIcon weight="fill" />
    }
  }

  // Get tooltip text based on includeInFull state
  const getIncludeTooltip = () => {
    const count = wordCount()
    const n = contentNode()
    const includeVal = n?.includeInFull ?? 2
    const hasSummary = !!n?.summary
    const stateText = includeVal === 0 ? 'Not included' : includeVal === 2 ? 'Full content' : 'Summary only'
    const summaryNote = !hasSummary ? '\n(No summary available)' : ''
    return `${count.toLocaleString()} words • ${stateText}${summaryNote}\nClick to cycle`
  }

  // Cycle through includeInFull states: 1 -> 2 -> 0 -> 1
  // If node has no summary, skip state 1 (summary): 2 -> 0 -> 2
  const handleCycleInclude = (e: MouseEvent) => {
    e.stopPropagation()
    const n = contentNode()
    if (!n || n.type !== 'scene') return

    const currentVal = n.includeInFull ?? 2
    const hasSummary = !!n.summary
    let nextVal: number

    if (hasSummary) {
      // Full cycle: full -> summary -> not included -> full
      if (currentVal === 2)
        nextVal = 1 // full -> summary
      else if (currentVal === 1)
        nextVal = 0 // summary -> not included
      else nextVal = 2 // not included -> full
    } else {
      // No summary available, skip summary state: full -> not included -> full
      if (currentVal === 2)
        nextVal = 0 // full -> not included
      else nextVal = 2 // not included (or summary) -> full
    }

    nodeStore.updateNode(n.id, { includeInFull: nextVal })
  }

  const getIcon = () => {
    const n = node()
    if (!n) return null
    switch (n.type) {
      case 'book':
        return <PhBookIcon />
      case 'arc':
        return <PhBookOpenIcon weight="fill" />
      case 'chapter':
        return <PhBookIcon />
      case 'scene':
        return <PhFileTextIcon /> // Different icon for scenes
      default:
        return null
    }
  }

  const getStatusColor = () => {
    const n = node()
    if (!n || n.type !== 'chapter') return undefined
    const status = n.status
    switch (status) {
      case 'done':
        return '#22c55e'
      case 'review':
        return '#3b82f6'
      case 'needs_work':
        return '#f97316'
      case 'draft':
        return '#94a3b8'
      default:
        return undefined
    }
  }

  const handleToggleExpand = (e: MouseEvent) => {
    e.stopPropagation()
    if (hasChildren()) {
      nodeStore.toggleExpanded(props.treeNode.id)
    }
  }

  const handleSelect = (event: MouseEvent) => {
    const n = node()
    if (!n) return

    if (event.shiftKey) {
      event.stopPropagation()
      toggleSelection(props.treeNode.id)
      return
    }

    clearSelection()

    // Only select scene nodes (scenes contain the actual content/messages).
    // A chapter with its single scene merged in selects that scene.
    if (n.type === 'scene' || mergedSceneId()) {
      nodeStore.selectNode(contentNodeId())
      // Call the callback if provided (for mobile auto-close)
      props.onSelectChapter?.()
    } else if (hasChildren()) {
      // For non-scene nodes, just toggle expansion
      nodeStore.toggleExpanded(props.treeNode.id)
    }
  }

  const handleAddChild = (e: MouseEvent) => {
    e.stopPropagation()
    const n = node()
    if (!n) return
    switch (n.type) {
      case 'book':
        nodeStore.addNode(props.treeNode.id, 'arc')
        return
      case 'arc':
        // New chapters get their first scene automatically
        nodeStore.addChapter(props.treeNode.id)
        return
      case 'chapter':
        nodeStore.addNode(props.treeNode.id, 'scene')
        return
      default:
        return // Scenes can't have children (messages are separate)
    }
  }

  const handleEdit = (e?: MouseEvent) => {
    e?.stopPropagation()
    const n = node()
    if (!n) return
    setIsEditing(true)
    setEditTitle(n.title)
    // Select the text after the input is rendered
    requestAnimationFrame(() => {
      editInputRef?.select()
    })
  }

  const handleCopyAsMarkdown = async () => {
    const n = node()
    if (!n) return

    const markdown = buildNodeMarkdown(n.id)
    if (!markdown) {
      alert('No story content available to copy yet.')
      return
    }

    if (!navigator.clipboard) {
      copyPreviewStore.showFallbackDialog(markdown)
      return
    }

    try {
      await navigator.clipboard.writeText(markdown)
    } catch (error) {
      console.error('Failed to copy node as Markdown:', error)
      copyPreviewStore.showFallbackDialog(markdown)
    }
  }

  const handleCopyPreviousContext = async () => {
    const n = node()
    if (!n) return

    const summary = buildPrecedingContextMarkdown(n.id, {
      includeCurrentNode: false,
      mode: 'summary',
    })

    if (!summary) {
      alert('No previous chapters with content were found to copy.')
      return
    }

    await copyPreviewStore.requestCopy(summary)
  }

  const handleSaveEdit = () => {
    if (editTitle().trim()) {
      nodeStore.updateNode(props.treeNode.id, { title: editTitle().trim() })
    }
    setIsEditing(false)
  }

  const handleCancelEdit = () => {
    const n = node()
    if (!n) return
    setIsEditing(false)
    setEditTitle(n.title)
  }

  onCleanup(() => {
    if (dragPreviewEl?.parentNode) {
      dragPreviewEl.parentNode.removeChild(dragPreviewEl)
    }
    dragPreviewEl = null
  })

  const handleDelete = (e?: MouseEvent) => {
    const n = node()
    if (!n) return
    const permanent = e?.shiftKey ?? false
    const confirmMsg = permanent
      ? `PERMANENTLY delete ${n.type} "${n.title}" and all its contents? This cannot be undone!`
      : `Delete ${n.type} "${n.title}" and all its contents?`
    if (confirm(confirmMsg)) {
      nodeStore.deleteNode(props.treeNode.id, permanent)
    }
  }

  const handleMoveUp = () => {
    const n = node()
    if (!n) return
    const siblings = Object.values(nodeStore.nodes)
      .filter((nd) => nd.parentId === n.parentId)
      .sort((a, b) => a.order - b.order)
    const currentIndex = siblings.findIndex((nd) => nd.id === props.treeNode.id)

    if (currentIndex > 0) {
      // Swap with previous sibling
      nodeStore.moveNode(props.treeNode.id, n.parentId ?? null, currentIndex - 1)
    }
  }

  const handleMoveDown = () => {
    const n = node()
    if (!n) return
    const siblings = Object.values(nodeStore.nodes)
      .filter((nd) => nd.parentId === n.parentId)
      .sort((a, b) => a.order - b.order)
    const currentIndex = siblings.findIndex((nd) => nd.id === props.treeNode.id)

    if (currentIndex < siblings.length - 1) {
      // Swap with next sibling
      nodeStore.moveNode(props.treeNode.id, n.parentId ?? null, currentIndex + 1)
    }
  }

  const handleDragStart = (event: DragEvent) => {
    const currentNode = node()
    if (!currentNode) return

    const target = event.target as HTMLElement | null
    if (target?.closest('button')) {
      event.preventDefault()
      return
    }

    if (isEditing()) {
      event.preventDefault()
      return
    }

    event.stopPropagation()
    let dragSelection = selectedIds()

    if (!dragSelection.includes(currentNode.id)) {
      dragSelection = [currentNode.id]
    }

    dragSelection = dragSelection.filter((id) => nodeStore.nodes[id]?.type === currentNode.type)

    if (!dragSelection.includes(currentNode.id)) {
      dragSelection = [currentNode.id]
    }

    const orderedSelection = orderIdsByTree(dragSelection)
    setSelection(orderedSelection)
    startDrag(orderedSelection)
    setDropTarget(null)
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move'
      event.dataTransfer.setData('application/x-story-node', orderedSelection.join(','))
      if (currentNode.title) {
        event.dataTransfer.setData('text/plain', currentNode.title)
      }

      if (orderedSelection.length > 1) {
        const dragNodes = orderedSelection
          .map((id) => nodeStore.nodes[id])
          .filter((dragNode): dragNode is Node => Boolean(dragNode))

        if (dragNodes.length > 0) {
          const typeLabel = getTypeLabel(dragNodes[0]?.type ?? currentNode.type, orderedSelection.length)

          dragPreviewEl = document.createElement('div')
          Object.assign(dragPreviewEl.style, {
            position: 'fixed',
            top: '0',
            left: '0',
            pointerEvents: 'none',
            padding: '0.35rem 0.6rem',
            borderRadius: '8px',
            background: 'rgba(30, 41, 59, 0.92)',
            color: 'var(--text-primary)',
            boxShadow: '0 10px 30px rgba(15, 23, 42, 0.35)',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.125rem',
            fontSize: '0.8rem',
            zIndex: '2000',
          })

          const countEl = document.createElement('div')
          Object.assign(countEl.style, {
            fontWeight: '600',
            color: '#f1f5f9',
          })
          countEl.textContent = `${orderedSelection.length} ${typeLabel}`
          dragPreviewEl.appendChild(countEl)

          const firstNode = dragNodes[0]
          if (firstNode?.title) {
            const titleEl = document.createElement('div')
            Object.assign(titleEl.style, {
              color: '#94a3b8',
              fontSize: '0.75rem',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              maxWidth: '180px',
            })
            titleEl.textContent = firstNode.title
            dragPreviewEl.appendChild(titleEl)
          }

          const remainingCount = orderedSelection.length - 1
          if (remainingCount > 0) {
            const moreEl = document.createElement('div')
            Object.assign(moreEl.style, {
              color: '#64748b',
              fontSize: '0.7rem',
            })
            moreEl.textContent = remainingCount === 1 ? '+1 more' : `+${remainingCount} more`
            dragPreviewEl.appendChild(moreEl)
          }

          document.body.appendChild(dragPreviewEl)
          const rect = dragPreviewEl.getBoundingClientRect()
          event.dataTransfer.setDragImage(dragPreviewEl, Math.floor(rect.width / 2), Math.floor(rect.height / 2))

          setTimeout(() => {
            if (dragPreviewEl?.parentNode) {
              dragPreviewEl.parentNode.removeChild(dragPreviewEl)
            }
            dragPreviewEl = null
          }, 0)
        }
      }
    }
  }

  const handleDragEnd = () => {
    if (dragPreviewEl?.parentNode) {
      dragPreviewEl.parentNode.removeChild(dragPreviewEl)
    }
    dragPreviewEl = null
    endDrag()
  }

  const handleDragOver = (event: DragEvent) => {
    const draggingIdsList = draggingIds()
    if (draggingIdsList.length === 0) {
      return
    }

    if (draggingIdsList.includes(props.treeNode.id)) {
      if (isDropTarget()) {
        setDropTarget(null)
      }
      return
    }

    const currentNode = node()
    if (!currentNode) return

    const draggingNodes = draggingIdsList
      .map((id) => nodeStore.nodes[id])
      .filter((dragNode): dragNode is Node => Boolean(dragNode))

    if (draggingNodes.length === 0) {
      return
    }

    const primaryDragNode = draggingNodes[0]
    if (draggingNodes.some((dragNode) => dragNode.type !== primaryDragNode.type)) {
      if (isDropTarget()) {
        setDropTarget(null)
      }
      return
    }

    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
    const offsetY = event.clientY - rect.top
    const topThreshold = rect.height * 0.25
    const bottomThreshold = rect.height * 0.75

    let position: DropPosition = offsetY < topThreshold ? 'before' : offsetY > bottomThreshold ? 'after' : 'inside'

    if (position === 'inside' && !canDropInsideNodes(currentNode, draggingNodes)) {
      position = offsetY < rect.height / 2 ? 'before' : 'after'
    }

    if (
      (position === 'before' || position === 'after') &&
      !canDropAsSiblingNodes(currentNode.parentId ?? null, draggingNodes)
    ) {
      if (canDropInsideNodes(currentNode, draggingNodes)) {
        position = 'inside'
      } else {
        if (isDropTarget()) {
          setDropTarget(null)
        }
        return
      }
    }

    if (position === 'inside' && !canDropInsideNodes(currentNode, draggingNodes)) {
      if (isDropTarget()) {
        setDropTarget(null)
      }
      return
    }

    event.preventDefault()
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'move'
    }
    setDropTarget({
      nodeId: props.treeNode.id,
      position,
    })
  }

  const handleDrop = (event: DragEvent) => {
    const draggingIdsList = draggingIds()
    const targetDetails = dropTarget()
    if (draggingIdsList.length === 0 || !targetDetails || targetDetails.nodeId !== props.treeNode.id) {
      return
    }

    const currentNode = node()
    if (!currentNode) return

    const orderedDraggingIds = orderIdsByTree(draggingIdsList)
    const draggingNodes = orderedDraggingIds
      .map((id) => nodeStore.nodes[id])
      .filter((dragNode): dragNode is Node => Boolean(dragNode))

    if (draggingNodes.length === 0) {
      setDropTarget(null)
      endDrag()
      return
    }

    event.preventDefault()
    event.stopPropagation()

    if (targetDetails.position === 'inside') {
      const childCount = getSortedSiblings(currentNode.id, orderedDraggingIds).length
      draggingNodes.forEach((dragNode, index) => {
        nodeStore.moveNode(dragNode.id, currentNode.id, childCount + index)
      })
      if (!nodeStore.isExpanded(currentNode.id)) {
        nodeStore.toggleExpanded(currentNode.id)
      }
    } else {
      const parentId = currentNode.parentId ?? null
      const siblings = getSortedSiblings(parentId, orderedDraggingIds)
      const targetIndex = siblings.findIndex((sibling) => sibling.id === currentNode.id)
      if (targetIndex === -1) {
        setDropTarget(null)
        endDrag()
        return
      }
      const baseIndex = targetDetails.position === 'before' ? targetIndex : targetIndex + 1
      draggingNodes.forEach((dragNode, offset) => {
        nodeStore.moveNode(dragNode.id, parentId, baseIndex + offset)
      })
    }

    setDropTarget(null)
    endDrag()
  }

  const handleGenerateSummary = async () => {
    try {
      await nodeStore.generateNodeSummary(contentNodeId(), messagesStore.messages, generateNodeSummary)
    } catch (error) {
      console.error('Failed to generate summary:', error)
      alert(`Failed to generate summary: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  const handleGenerateTitle = async (source: 'summary' | 'content') => {
    const n = node()
    if (!n) return

    let text: string | undefined

    if (source === 'summary') {
      // Summaries live on the scene, which for a merged row is not this node
      text = contentNode()?.summary
      if (!text) return
    } else {
      // Get content from messages in this node
      const nodeMessages = messagesStore.messages.filter(
        (msg) => msg.sceneId === contentNodeId() && msg.role === 'assistant' && msg.type !== 'chapter' && !msg.isQuery,
      )
      text = nodeMessages.map((msg) => msg.content).join('\n\n')
      if (!text.trim()) return
    }

    setIsGeneratingTitle(true)
    try {
      const title = await generateNodeTitle(text, n.type)
      if (title && title !== 'Untitled') {
        nodeStore.updateNode(props.treeNode.id, { title })
      }
    } catch (error) {
      console.error('Failed to generate title:', error)
    } finally {
      setIsGeneratingTitle(false)
    }
  }

  // Check if node can move up or down
  const canMoveUp = () => {
    const n = node()
    if (!n) return false
    // Get siblings from the flat nodes hash map, not from the tree
    const siblings = Object.values(nodeStore.nodes)
      .filter((nd) => nd.parentId === n.parentId)
      .sort((a, b) => a.order - b.order)

    const currentIndex = siblings.findIndex((nd) => nd.id === props.treeNode.id)
    return currentIndex > 0
  }

  const canMoveDown = () => {
    const n = node()
    if (!n) return false
    // Get siblings from the flat nodes hash map, not from the tree
    const siblings = Object.values(nodeStore.nodes)
      .filter((nd) => nd.parentId === n.parentId)
      .sort((a, b) => a.order - b.order)

    const currentIndex = siblings.findIndex((nd) => nd.id === props.treeNode.id)
    return currentIndex >= 0 && currentIndex < siblings.length - 1
  }

  // Compute header classes based on state
  const getNodeHeaderClasses = (): string => {
    const classes = [styles.nodeHeader]

    if (isSelected() && contentNode()?.includeInFull === 2) {
      classes.push(styles.nodeHeaderSelectedIncludeInFull)
    } else if (isSelected()) {
      classes.push(styles.nodeHeaderSelected)
    } else if (contentNode()?.includeInFull === 2) {
      classes.push(styles.nodeHeaderIncludeInFull)
    }

    if (!isActive()) {
      classes.push(styles.nodeHeaderInactive)
    }

    if (isDragging()) {
      classes.push(styles.nodeItemDragging)
    }

    if (isMultiSelected()) {
      classes.push(styles.nodeHeaderMultiSelected)
    }

    if (isDropTarget()) {
      if (dropPosition() === 'before') {
        classes.push(styles.nodeHeaderDropBefore)
      } else if (dropPosition() === 'after') {
        classes.push(styles.nodeHeaderDropAfter)
      } else if (dropPosition() === 'inside') {
        classes.push(styles.nodeHeaderDropInside)
      }
    }

    return classes.join(' ')
  }

  return (
    <div class={isDragging() ? `${styles.nodeItem} ${styles.nodeItemDragging}` : styles.nodeItem}>
      <div
        class={getNodeHeaderClasses()}
        style={{ 'padding-left': `${props.level * 8 + 4}px` }}
        data-selected={isSelected() ? 'true' : undefined}
        onClick={handleSelect}
        draggable={!isEditing()}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragEnter={handleDragOver}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        <Show when={hasChildren()}>
          <button class={styles.expandButton} onClick={handleToggleExpand}>
            {isExpanded() ? <PhCaretDownIcon /> : <PhCaretRightIcon />}
          </button>
        </Show>
        <Show when={!hasChildren()}>
          <div class={styles.expandPlaceholder} />
        </Show>

        <span class={styles.nodeIcon}>{getIcon()}</span>

        <Show when={node()?.type === 'chapter'}>
          <PublishingBadge publishedAt={node()?.publishedAt} />
        </Show>

        <Show when={!isEditing()}>
          <span
            class={styles.nodeTitle}
            style={{ color: matchesStorylineFilter() ? 'var(--primary-color)' : getStatusColor() }}
            title={
              mergedSceneId() ? `ID: ${props.treeNode.id}\nScene ID: ${mergedSceneId()}` : `ID: ${props.treeNode.id}`
            }
            onDblClick={handleEdit}
          >
            {node()?.title}
          </span>
        </Show>

        <Show when={isEditing()}>
          <input
            ref={editInputRef}
            class={styles.editInput}
            value={editTitle()}
            onInput={(e) => setEditTitle(e.currentTarget.value)}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSaveEdit()
              if (e.key === 'Escape') handleCancelEdit()
            }}
            onBlur={handleSaveEdit}
            autofocus
          />
        </Show>

        <div class={styles.nodeControls}>
          <div class={styles.nodeIndicators}>
            <Show when={childCount() > 1}>
              <span class={styles.childCount} title={childCountLabel()}>
                {childCount()}
              </span>
            </Show>

            <Show when={hasScriptErrors()}>
              <span
                class={styles.indicatorIcon}
                title={getScriptErrorsTooltip()}
                style={{ color: '#ef4444' }}
              >
                <PhCodeIcon />
              </span>
            </Show>

            <Show when={hasScriptChanges() && !hasScriptErrors()}>
              <span
                class={styles.indicatorIcon}
                title={getScriptChangesTooltip()}
                style={{ color: '#9333ea' }}
              >
                <PhCodeIcon />
              </span>
            </Show>

            <Show when={hasBranches()}>
              <span
                class={styles.indicatorIcon}
                title="This scene contains branch points"
                style={{ color: '#06b6d4' }}
              >
                <PhTreeStructureIcon />
              </span>
            </Show>

            <Show when={needsStoryTime()}>
              <span
                class={styles.indicatorIcon}
                title="This scene doesn't have a storyTime set"
                style={{ color: '#ef4444' }}
              >
                <PhClockIcon />
              </span>
            </Show>

            <Show when={needsSummary()}>
              <span
                class={styles.indicatorIcon}
                title="This scene has content but no summary"
                style={{ color: '#f59e0b' }}
              >
                <PhWarningIcon />
              </span>
            </Show>

            <Show when={hasAnySummaryLevel()}>
              <span class={styles.summaryLevels} title={summaryLevelsTooltip()}>
                <For each={summaryLevels()}>
                  {(level) => (
                    <span
                      class={level.filled ? `${styles.summaryLevel} ${styles.summaryLevelActive}` : styles.summaryLevel}
                    >
                      {level.label}
                    </span>
                  )}
                </For>
              </span>
            </Show>

            <Show when={contentNode()?.type === 'scene'}>
              <span
                class={styles.indicatorIcon}
                title={getIncludeTooltip()}
                style={{ color: getWordCountColor(), 'font-size': '1em' }}
                onClick={handleCycleInclude}
              >
                {getIncludeIcon()}
              </span>
            </Show>

            <Show when={contentNode()?.isSummarizing}>
              <span class={styles.loadingIndicator} title="Generating summary...">
                <span class={styles.spinner}>⟳</span>
              </span>
            </Show>
          </div>

          <div class={styles.nodeActions}>
          <Show when={node()?.type === 'chapter'}>
            <button
              class={styles.actionButton}
              onClick={(e) => {
                e.stopPropagation()
                props.onPublishChapter?.(props.treeNode.id)
              }}
              title="Publishing…"
              aria-label="Chapter publishing"
            >
              <PhGlobeIcon />
            </button>
          </Show>
          <Show when={node()?.type !== 'scene'}>
            <button
              class={styles.actionButton}
              onClick={handleAddChild}
              title={`Add ${node()?.type === 'book' ? 'Arc' : node()?.type === 'arc' ? 'Chapter' : 'Scene'}`}
            >
              <PhPlusCircleIcon />
            </button>
          </Show>

          <Dropdown
            portal
            alignRight
            trigger={
              <button class={styles.actionButton}>
                <PhDotsThreeIcon />
              </button>
            }
          >
            <DropdownItem icon={<PhPencilSimpleIcon />} onClick={handleEdit}>
              Edit Title
            </DropdownItem>
            <Show when={node()?.type === 'chapter' || node()?.type === 'scene'}>
              <Show when={contentNode()?.summary}>
                <DropdownItem
                  icon={<PhFileTextIcon weight="fill" />}
                  onClick={() => handleGenerateTitle('summary')}
                  disabled={isGeneratingTitle()}
                >
                  {isGeneratingTitle() ? 'Generating...' : 'Generate Title from Summary'}
                </DropdownItem>
              </Show>
              <DropdownItem
                icon={<PhFileTextIcon />}
                onClick={() => handleGenerateTitle('content')}
                disabled={isGeneratingTitle()}
              >
                {isGeneratingTitle() ? 'Generating...' : 'Generate Title from Content'}
              </DropdownItem>
            </Show>
            <DropdownItem icon={<PhFileTextIcon />} onClick={handleCopyAsMarkdown}>
              Copy as Markdown
            </DropdownItem>
            <Show when={node()?.type === 'book'}>
              <DropdownItem
                icon={<PhInfoIcon />}
                onClick={() => props.onOpenBookDetails?.(props.treeNode.id)}
              >
                Details…
              </DropdownItem>
              <DropdownItem
                icon={<PhSignOutIcon />}
                onClick={() => props.onExtractBook?.(props.treeNode.id)}
              >
                Export to New Story
              </DropdownItem>
            </Show>
            <Show when={node()?.type === 'chapter' || node()?.type === 'scene'}>
              <DropdownItem
                icon={
                  contentNode()?.isSummarizing ? undefined : contentNode()?.summary ? (
                    <PhCheckCircleIcon />
                  ) : (
                    <PhFileTextIcon />
                  )
                }
                onClick={handleGenerateSummary}
                disabled={contentNode()?.isSummarizing}
              >
                {contentNode()?.isSummarizing
                  ? 'Generating...'
                  : contentNode()?.summary
                    ? 'Regenerate Summary'
                    : 'Generate Summary'}
              </DropdownItem>
              <DropdownItem icon={<PhFileTextIcon weight="fill" />} onClick={handleCopyPreviousContext}>
                Copy Previous Context
              </DropdownItem>
            </Show>
            <Show when={node()?.type === 'chapter'}>
              <NodeStatusMenu
                currentStatus={node()?.status}
                onSelect={(status) => nodeStore.updateNode(props.treeNode.id, { status })}
              />
            </Show>
            <Show when={contentNode()?.type === 'scene'}>
              <DropdownItem
                icon={<PhCircleHalfIcon weight="fill" />}
                onClick={() => nodeStore.setIncludeForPrecedingScenes(contentNodeId(), 1)}
              >
                Use Summaries Before
              </DropdownItem>
              <DropdownItem
                icon={<PhCircleIcon />}
                onClick={() => nodeStore.setIncludeForPrecedingScenes(contentNodeId(), 0)}
              >
                Exclude All Before
              </DropdownItem>
              <DropdownItem
                icon={<PhScissorsIcon />}
                onClick={() => props.onSplitScene?.(contentNodeId())}
              >
                Split into Chapters/Scenes
              </DropdownItem>
            </Show>
            <DropdownItem
              icon={<PhPlusCircleIcon />}
              onClick={() => {
                const n = node()
                if (!n) return
                const inserted = nodeStore.insertNodeBefore(props.treeNode.id, n.type)
                // New chapters get their first scene automatically
                if (inserted?.type === 'chapter') nodeStore.ensureFirstScene(inserted.id)
              }}
            >
              Insert {node()?.type === 'book' ? 'Book' : node()?.type === 'arc' ? 'Arc' : node()?.type === 'chapter' ? 'Chapter' : 'Scene'} Before
            </DropdownItem>
            <Show when={canMoveUp()}>
              <DropdownItem icon={<PhArrowUpIcon />} onClick={handleMoveUp}>
                Move Up
              </DropdownItem>
            </Show>
            <Show when={canMoveDown()}>
              <DropdownItem icon={<PhArrowDownIcon />} onClick={handleMoveDown}>
                Move Down
              </DropdownItem>
            </Show>
            <DropdownItem
              icon={<PhImageIcon />}
              onClick={() => props.onOpenBackgroundOptions?.(props.treeNode.id)}
            >
              Background…
            </DropdownItem>
            <DropdownItem icon={<PhTrashIcon />} onClick={handleDelete} danger>
              Delete
            </DropdownItem>
          </Dropdown>
        </div>
        </div>
      </div>

      <Show when={isExpanded() && hasChildren()}>
        <div class={styles.childrenContainer}>
          <For each={props.treeNode.children}>
            {(child) => <NodeItem treeNode={child} level={props.level + 1} onSelectChapter={props.onSelectChapter} onSplitScene={props.onSplitScene} onExtractBook={props.onExtractBook} onPublishChapter={props.onPublishChapter} onOpenBookDetails={props.onOpenBookDetails} onOpenBackgroundOptions={props.onOpenBackgroundOptions} />}
          </For>
        </div>
      </Show>
    </div>
  )
}

interface StoryNavigationProps {
  onSelectChapter?: () => void
}

// Type for storing includeInFull presets
interface IncludePreset {
  settings: Record<string, number> // nodeId -> includeInFull value
}

export const StoryNavigation: Component<StoryNavigationProps> = (props) => {
  let treeContainerRef: HTMLDivElement | undefined
  const [showCharacterUpdateModal, setShowCharacterUpdateModal] = createSignal(false)
  const [showContextItemGenerateModal, setShowContextItemGenerateModal] = createSignal(false)
  const [showSplitSceneModal, setShowSplitSceneModal] = createSignal(false)
  const [splitTargetNodeId, setSplitTargetNodeId] = createSignal<string | null>(null)
  const [showStoryPublishingModal, setShowStoryPublishingModal] = createSignal(false)
  const [showStoryDetailsModal, setShowStoryDetailsModal] = createSignal(false)
  const [bookDetailsTargetId, setBookDetailsTargetId] = createSignal<string | null>(null)
  const [showRoyalRoadPanel, setShowRoyalRoadPanel] = createSignal(false)
  const [chapterPublishingTargetId, setChapterPublishingTargetId] = createSignal<string | null>(null)
  const handlePublishChapter = (chapterId: string) => setChapterPublishingTargetId(chapterId)

  // Background-options modal target. Null = closed; 'story' = story-level
  // (entityId derived from currentStoryStore at open time); otherwise the
  // node id of a book/arc/chapter/scene whose default we're editing.
  const [backgroundTarget, setBackgroundTarget] = createSignal<
    | { level: 'story' }
    | { level: 'book' | 'arc' | 'chapter' | 'scene'; nodeId: string }
    | null
  >(null)
  const handleOpenNodeBackground = (nodeId: string) => {
    const n = nodeStore.nodes[nodeId]
    if (!n) return
    if (n.type === 'book' || n.type === 'arc' || n.type === 'chapter' || n.type === 'scene') {
      setBackgroundTarget({ level: n.type, nodeId })
    }
  }

  // LocalStorage key for presets (per-story)
  const getPresetsKey = () => `story-presets-${currentStoryStore.id}`

  // Load presets from localStorage
  const loadPresetsFromStorage = (): (IncludePreset | null)[] => {
    try {
      const stored = localStorage.getItem(getPresetsKey())
      if (stored) {
        return JSON.parse(stored)
      }
    } catch (e) {
      console.error('Failed to load presets from localStorage:', e)
    }
    return [null, null, null]
  }

  // Save presets to localStorage
  const savePresetsToStorage = (presetsData: (IncludePreset | null)[]) => {
    try {
      localStorage.setItem(getPresetsKey(), JSON.stringify(presetsData))
    } catch (e) {
      console.error('Failed to save presets to localStorage:', e)
    }
  }

  // Preset state for includeInFull settings (3 slots)
  const [presets, setPresets] = createSignal<(IncludePreset | null)[]>(loadPresetsFromStorage())

  // Reload presets when story changes
  createEffect(() => {
    // Track story ID to reload presets when it changes
    const storyId = currentStoryStore.id
    if (storyId) {
      setPresets(loadPresetsFromStorage())
    }
  })

  // Save current includeInFull settings to a preset slot
  const savePreset = (slotIndex: number) => {
    const settings: Record<string, number> = {}
    for (const node of nodeStore.nodesArray) {
      if (node.type === 'scene' && node.includeInFull !== undefined) {
        settings[node.id] = node.includeInFull
      }
    }
    setPresets((prev) => {
      const next = [...prev]
      next[slotIndex] = { settings }
      savePresetsToStorage(next)
      return next
    })
  }

  // Restore includeInFull settings from a preset slot
  const restorePreset = (slotIndex: number) => {
    const preset = presets()[slotIndex]
    if (!preset) return

    // Apply stored settings to nodes
    for (const [nodeId, includeValue] of Object.entries(preset.settings)) {
      const node = nodeStore.nodes[nodeId]
      if (node && node.type === 'scene') {
        nodeStore.updateNode(nodeId, { includeInFull: includeValue })
      }
    }

    // Clear the preset after restoring
    setPresets((prev) => {
      const next = [...prev]
      next[slotIndex] = null
      savePresetsToStorage(next)
      return next
    })
  }

  // Toggle preset: save if empty, restore if stored
  const togglePreset = (slotIndex: number) => {
    const preset = presets()[slotIndex]
    if (preset) {
      restorePreset(slotIndex)
    } else {
      savePreset(slotIndex)
    }
  }

  const handleSplitScene = (nodeId: string) => {
    setSplitTargetNodeId(nodeId)
    setShowSplitSceneModal(true)
  }

  const handleCloseSplitSceneModal = () => {
    setShowSplitSceneModal(false)
    setSplitTargetNodeId(null)
  }

  const navigate = useNavigate()

  const handleExtractBook = async (bookId: string) => {
    if (!confirm('This will create a new story from this book. Continue?')) return

    try {
      const { getMyStoriesByIdLoadStory, getApiBaseUrl } = await import('../client/config')
      const result = await getMyStoriesByIdLoadStory({ path: { id: currentStoryStore.id } })
      const exportData = result.data

      if (!exportData) {
        throw new Error('Failed to fetch story export data')
      }

      const targetBook = exportData.books.find((b) => b.id === bookId)
      if (!targetBook) {
        throw new Error('Book not found in export data')
      }

      const bookTitle = targetBook.name || 'Extracted Book'

      const filteredExport = {
        story: { ...exportData.story, name: bookTitle },
        books: [targetBook],
        characters: exportData.characters,
        contextItems: exportData.contextItems,
        calendars: exportData.calendars,
        languages: exportData.languages,
        maps: exportData.maps,
      }

      const blob = new Blob([JSON.stringify(filteredExport)], { type: 'application/json' })
      const formData = new FormData()
      formData.append('file', blob, `${bookTitle}.json`)

      const baseUrl = getApiBaseUrl()
      const response = await fetch(`${baseUrl}/my/stories/import-zip`, {
        method: 'POST',
        body: formData,
        credentials: 'include',
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Import failed')
      }

      const importResult = await response.json()
      navigate(`/story/${importResult.storyId}`)
    } catch (error) {
      console.error('Failed to extract book to new story:', error)
      alert(`Failed to export book to new story: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  // Signal to hold the async token count result
  const [tokenCountResult, setTokenCountResult] = createSignal<{
    tokens: number
    isExact: boolean
    isLoading: boolean
  } | null>(null)

  // Fingerprint memo: captures the relevant state for token counting
  // Only changes when includeInFull values or content actually changes
  const contextFingerprint = createMemo(() => {
    const nodes = nodeStore.nodesArray
    const fullContentNodes = nodes.filter((n) => n.includeInFull === 2)
    const summaryNodes = nodes.filter((n) => n.includeInFull === 1 && n.summary)

    if (fullContentNodes.length === 0 && summaryNodes.length === 0) {
      return null
    }

    // Build a fingerprint that includes:
    // - node IDs and their includeInFull values
    // - content length (as a proxy for content changes)
    // - provider and model (to know when to use API vs heuristic)
    const nodeFingerprints = [
      ...fullContentNodes.map((n) => `${n.id}:2:${n.wordCount || 0}`),
      ...summaryNodes.map((n) => `${n.id}:1:${(n.summary || '').length}`),
    ].sort()

    return {
      fingerprint: nodeFingerprints.join('|'),
      provider: effectiveSettings.provider,
      model: effectiveSettings.model,
      fullContentNodes,
      summaryNodes,
    }
  })

  // Effect that watches the fingerprint and triggers token counting (debounced)
  // We debounce to avoid constant recalculation during streaming
  let tokenCountTimeout: ReturnType<typeof setTimeout> | null = null

  createEffect(() => {
    const fp = contextFingerprint()

    // Clear any pending timeout when fingerprint changes
    if (tokenCountTimeout) {
      clearTimeout(tokenCountTimeout)
      tokenCountTimeout = null
    }

    if (!fp) {
      setTokenCountResult(null)
      return
    }

    const { provider, model, fullContentNodes, summaryNodes } = fp

    // Debounce token counting by 2 seconds to avoid constant updates during streaming
    tokenCountTimeout = setTimeout(() => {
      // Build content for token counting
      let totalContent = ''
      for (const node of fullContentNodes) {
        const markdown = buildNodeMarkdown(node.id)
        if (markdown) {
          totalContent += `## ${node.title}\n\n${markdown}\n\n`
        }
      }
      for (const node of summaryNodes) {
        if (node.summary) {
          totalContent += `## ${node.title} (Summary)\n\n${node.summary}\n\n`
        }
      }

      // For Anthropic, use the API; otherwise use heuristic
      if (provider === 'anthropic' && model && settingsStore.anthropicApiKey) {
        // Set loading state
        setTokenCountResult({ tokens: 0, isExact: false, isLoading: true })

        const client = createAnthropicClient()
        client
          .countTokens([{ role: 'user', content: totalContent }], model)
          .then((tokens) => {
            setTokenCountResult({ tokens, isExact: true, isLoading: false })
          })
          .catch((err) => {
            console.error('Failed to count tokens via Anthropic API:', err)
            // Fall back to heuristic on error
            const tokens = estimateTokensFromText(totalContent)
            setTokenCountResult({ tokens, isExact: false, isLoading: false })
          })
      } else {
        // Use heuristic for non-Anthropic providers
        const tokens = estimateTokensFromText(totalContent)
        setTokenCountResult({ tokens, isExact: false, isLoading: false })
      }
    }, 2000)
  })

  // Clean up timeout on unmount
  onCleanup(() => {
    if (tokenCountTimeout) {
      clearTimeout(tokenCountTimeout)
    }
  })

  // Derived memo for the full context estimate (combines token count with context limits)
  const contextTokenEstimate = createMemo(() => {
    const fp = contextFingerprint()
    const tokenResult = tokenCountResult()

    if (!fp || !tokenResult) {
      return null
    }

    const { fullContentNodes, summaryNodes } = fp
    const { tokens, isExact, isLoading } = tokenResult

    // Get model context limit
    const model = effectiveSettings.model
    const modelInfo = modelsStore.availableModels.find((m: { name: string }) => m.name === model)
    const contextLimit = modelInfo?.context_length || 4096

    // Reserve tokens for prompt overhead (~2000) and output (~4096)
    const reserved = 6096
    const availableForContent = Math.max(0, contextLimit - reserved)
    const percentUsed = availableForContent > 0 ? Math.round((tokens / availableForContent) * 100) : 100

    return {
      tokens,
      isExact,
      isLoading,
      contextLimit,
      availableForContent,
      percentUsed,
      fitsInContext: tokens <= availableForContent,
      fullContentCount: fullContentNodes.length,
      summaryCount: summaryNodes.length,
    }
  })

  // Cache status memo - checks if current context is cached
  const cacheStatus = createMemo(() => {
    const fingerprint = getContextNodesFingerprint(nodeStore.nodesArray)
    if (!fingerprint) return null

    const remainingMs = cacheStore.getCacheRemainingMs(fingerprint)
    if (remainingMs <= 0) return null

    // Convert to minutes
    const remainingMinutes = Math.ceil(remainingMs / 60000)
    return {
      remainingMinutes,
      fingerprint,
    }
  })

  const handleAddBook = () => {
    nodeStore.addNode(null, 'book', 'New Book')
  }

  // Auto-scroll to selected item on mount and when selection changes
  const scrollToSelected = (instant = false) => {
    if (!treeContainerRef || !nodeStore.selectedNodeId) return

    // Give DOM time to render, then find and scroll to selected element
    requestAnimationFrame(() => {
      const selectedElement = treeContainerRef.querySelector(`[data-selected="true"]`)
      if (selectedElement) {
        // Use scrollIntoView with center alignment
        selectedElement.scrollIntoView({
          behavior: instant ? 'instant' : 'smooth',
          block: 'center',
        })
      }
    })
  }

  // Scroll on mount immediately with instant positioning
  onMount(() => {
    scrollToSelected(true) // Instant scroll - no animation
  })

  // Scroll when selected node changes
  createEffect(() => {
    // Access the signal to create dependency
    const selectedId = nodeStore.selectedNodeId
    if (selectedId) {
      scrollToSelected()
    }
  })

  const handleCopyTreeMarkdown = async () => {
    const markdown = buildTreeMarkdown()
    if (!markdown) {
      alert('No nodes available to copy yet.')
      return
    }

    await copyPreviewStore.requestCopy(markdown)
  }

  return (
    <TreeDragDropProvider>
      <div class={styles.navigation}>
        <div class={styles.treeContainer} ref={treeContainerRef}>
          {/* Synthetic story-level row — hosts story-wide actions (publishing) */}
          <div class={`${styles.nodeItem} ${styles.storyRow}`}>
            <div class={styles.nodeHeader} style={{ 'padding-left': '4px' }}>
              <span class={styles.expandLeaf} aria-hidden="true">●</span>
              <span class={styles.nodeIcon}>
                <PhBookOpenIcon weight="fill" />
              </span>
              <PublishingBadge publishedAt={currentStoryStore.publishedAt} />
              <span
                class={styles.nodeTitle}
                title={currentStoryStore.name || 'Story'}
              >
                {currentStoryStore.name || 'Story'}
              </span>
              <div class={styles.nodeControls} />
              <div class={styles.nodeActions}>
                <button
                  class={styles.actionButton}
                  onClick={(e) => {
                    e.stopPropagation()
                    setShowStoryDetailsModal(true)
                  }}
                  title="Story details"
                  aria-label="Story details"
                >
                  <PhInfoIcon />
                </button>
                <button
                  class={styles.actionButton}
                  onClick={(e) => {
                    e.stopPropagation()
                    setShowStoryPublishingModal(true)
                  }}
                  title="Story publishing"
                  aria-label="Story publishing"
                >
                  <PhGlobeIcon />
                </button>
                <button
                  class={styles.actionButton}
                  onClick={(e) => {
                    e.stopPropagation()
                    setBackgroundTarget({ level: 'story' })
                  }}
                  title="Default background"
                  aria-label="Default background"
                >
                  <PhImageIcon />
                </button>
                <button
                  class={styles.actionButton}
                  onClick={(e) => {
                    e.stopPropagation()
                    setShowRoyalRoadPanel(true)
                  }}
                  title="Royal Road publishing"
                  aria-label="Royal Road publishing"
                >
                  <PhBookIcon />
                </button>
              </div>
            </div>
          </div>

          <For each={nodeStore.tree}>
            {(treeNode) => <NodeItem treeNode={treeNode} level={0} onSelectChapter={props.onSelectChapter} onSplitScene={handleSplitScene} onExtractBook={handleExtractBook} onPublishChapter={handlePublishChapter} onOpenBookDetails={(bookId) => setBookDetailsTargetId(bookId)} onOpenBackgroundOptions={handleOpenNodeBackground} />}
          </For>

          <Show when={nodeStore.tree.length === 0}>
            <div class={styles.emptyState}>
              <p>No books yet</p>
              <button class={styles.addButton} onClick={handleAddBook}>
                <PhPlusCircleIcon /> Add Book
              </button>
            </div>
          </Show>
        </div>

        <Show when={nodeStore.tree.length > 0}>
          <div class={styles.footer}>
            {/* Token estimate for context selection */}
            <Show when={contextTokenEstimate()}>
              {(() => {
                const est = contextTokenEstimate()!
                const statusClass = !est.fitsInContext
                  ? styles.tokenEstimateError
                  : est.percentUsed > 80
                    ? styles.tokenEstimateWarning
                    : ''
                const tokenPrefix = est.isLoading ? '...' : est.isExact ? '' : '~'
                return (
                  <div class={`${styles.tokenEstimate} ${statusClass}`}>
                    <span>
                      Context: {tokenPrefix}{est.isLoading ? '' : est.tokens.toLocaleString()} tokens ({est.percentUsed}%)
                    </span>
                    <span class={styles.tokenEstimateDetail}>
                      {est.fullContentCount > 0 && `${est.fullContentCount} full`}
                      {est.fullContentCount > 0 && est.summaryCount > 0 && ', '}
                      {est.summaryCount > 0 && `${est.summaryCount} summary`}
                      <Show when={cacheStatus()}>
                        {' · '}
                        <span class={styles.cacheIndicator} title="Context is cached">
                          cached ({cacheStatus()!.remainingMinutes}m)
                        </span>
                      </Show>
                    </span>
                    <Show when={!est.fitsInContext}>
                      <span class={styles.tokenEstimateError}>exceeds limit!</span>
                    </Show>
                  </div>
                )
              })()}
            </Show>

            <div class={styles.footerButtonsGrid}>
              <div class={styles.footerRow}>
                <button class={styles.addButton} onClick={handleCopyTreeMarkdown} title="Copy Tree as Markdown">
                  <PhTreeStructureIcon /> Copy Tree
                </button>
                <button class={styles.addButton} onClick={() => setShowCharacterUpdateModal(true)} title="Update Character">
                  <PhUsersIcon /> Update Char
                </button>
                <button class={styles.addButton} onClick={() => setShowContextItemGenerateModal(true)} title="Generate Context Item">
                  <PhFileTextIcon /> Gen Context
                </button>
              </div>
              <div class={styles.footerRow}>
                <button class={styles.addButton} onClick={handleAddBook}>
                  <PhPlusCircleIcon /> Add Book
                </button>

                {/* Preset buttons for includeInFull settings */}
                <div class={styles.presetButtons}>
                  <For each={[0, 1, 2]}>
                    {(slotIndex) => {
                      const hasPreset = () => presets()[slotIndex] !== null
                      return (
                        <button
                          class={`${styles.presetButton} ${hasPreset() ? styles.presetButtonStored : ''}`}
                          onClick={() => togglePreset(slotIndex)}
                          title={hasPreset() ? `Restore preset ${slotIndex + 1}` : `Save current context to preset ${slotIndex + 1}`}
                        >
                          {hasPreset() ? <PhArrowCounterClockwiseIcon /> : <PhFloppyDiskIcon />}
                          <span>{slotIndex + 1}</span>
                        </button>
                      )
                    }}
                  </For>
                </div>
              </div>
            </div>
          </div>
        </Show>
      </div>

      <CharacterUpdateModal
        isOpen={showCharacterUpdateModal()}
        onClose={() => setShowCharacterUpdateModal(false)}
      />

      <ContextItemGenerateModal
        isOpen={showContextItemGenerateModal()}
        onClose={() => setShowContextItemGenerateModal(false)}
      />

      <SplitSceneModal
        isOpen={showSplitSceneModal()}
        onClose={handleCloseSplitSceneModal}
        targetNodeId={splitTargetNodeId()}
      />

      <StoryPublishingModal
        open={showStoryPublishingModal()}
        onClose={() => setShowStoryPublishingModal(false)}
      />

      <StoryDetailsModal
        isOpen={showStoryDetailsModal()}
        onClose={() => setShowStoryDetailsModal(false)}
      />

      <BookDetailsModal
        isOpen={bookDetailsTargetId() !== null}
        bookId={bookDetailsTargetId()}
        onClose={() => setBookDetailsTargetId(null)}
      />

      <RoyalRoadPublishingPanel
        open={showRoyalRoadPanel()}
        onClose={() => setShowRoyalRoadPanel(false)}
      />

      <ChapterPublishingModal
        open={chapterPublishingTargetId() !== null}
        chapterId={chapterPublishingTargetId()}
        onClose={() => setChapterPublishingTargetId(null)}
      />

      {(() => {
        const target = backgroundTarget()
        if (!target) {
          return (
            <BackgroundOptionsModal
              isOpen={false}
              target={null}
              onClose={() => setBackgroundTarget(null)}
            />
          )
        }
        if (target.level === 'story') {
          return (
            <BackgroundOptionsModal
              isOpen={true}
              target={{
                level: 'story',
                entityId: currentStoryStore.id ?? '',
                initialFileId: currentStoryStore.defaultBackgroundFileId ?? null,
                initialUrl: currentStoryStore.defaultBackgroundUrl ?? null,
                displayName: currentStoryStore.name ?? undefined,
              }}
              onClose={() => setBackgroundTarget(null)}
            />
          )
        }
        const node = nodeStore.nodes[target.nodeId]
        return (
          <BackgroundOptionsModal
            isOpen={true}
            target={{
              level: target.level,
              entityId: target.nodeId,
              initialFileId: node?.defaultBackgroundFileId ?? null,
              initialUrl: node?.defaultBackgroundUrl ?? null,
              displayName: node?.title,
            }}
            onClose={() => setBackgroundTarget(null)}
          />
        )
      })()}
    </TreeDragDropProvider>
  )
}
