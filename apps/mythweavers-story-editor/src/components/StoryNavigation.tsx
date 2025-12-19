import {
  BsArrowDown,
  BsArrowUp,
  BsBook,
  BsCheckCircle,
  BsChevronDown,
  BsChevronRight,
  BsClock,
  BsDiagram3,
  BsExclamationTriangle,
  BsFileEarmarkText,
  BsFileEarmarkTextFill,
  BsFileText,
  BsPencil,
  BsPlusCircle,
  BsThreeDots,
  BsTrash,
} from 'solid-icons/bs'
import { FaRegularCircle, FaSolidBookOpen, FaSolidCircleCheck, FaSolidCircleHalfStroke } from 'solid-icons/fa'
import { VsCode } from 'solid-icons/vs'
import { Component, For, type JSX, Show, createEffect, createSignal, onCleanup, onMount } from 'solid-js'
import { Portal } from 'solid-js/web'
import { useOllama } from '../hooks/useOllama'
import { copyPreviewStore } from '../stores/copyPreviewStore'
import { messagesStore } from '../stores/messagesStore'
import { navigationStore } from '../stores/navigationStore'
import { TreeNode, nodeStore } from '../stores/nodeStore'
import { scriptDataStore } from '../stores/scriptDataStore'
import { statsStore } from '../stores/statsStore'
import { Node, NodeType } from '../types/core'
import { buildNodeMarkdown, buildPrecedingContextMarkdown, buildTreeMarkdown } from '../utils/nodeContentExport'
import { NodeStatusMenu } from './NodeStatusMenu'
import * as styles from './StoryNavigation.css'
import { DropPosition, TreeDragDropProvider, useTreeDragDrop } from './TreeDragDropContext'

// Inline styles for StoryNavigation
const navStyles = {
  navigation: {
    width: '100%',
    height: '100%',
    display: 'flex',
    'flex-direction': 'column',
    overflow: 'hidden',
    background: 'var(--bg-secondary)',
  } as JSX.CSSProperties,

  treeContainer: {
    flex: '1',
    'overflow-y': 'auto',
    padding: '0.5rem',
    'min-height': '0',
  } as JSX.CSSProperties,

  nodeItem: {
    'user-select': 'none',
  } as JSX.CSSProperties,

  nodeHeader: {
    display: 'flex',
    'align-items': 'center',
    gap: '0.25rem',
    color: 'var(--text-primary)',
    padding: '0.125rem 0.25rem',
    cursor: 'pointer',
    transition: 'background-color 0.2s',
    position: 'relative',
    'border-left': '3px solid transparent',
  } as JSX.CSSProperties,

  nodeHeaderSelected: {
    'background-color': 'var(--accent-bg)',
    'border-left': '3px solid var(--accent-color)',
  } as JSX.CSSProperties,

  nodeHeaderIncludeInFull: {
    'background-color': 'rgba(255, 235, 59, 0.2)',
    'border-left': '3px solid #ffc107',
  } as JSX.CSSProperties,

  nodeHeaderSelectedIncludeInFull: {
    'background-color': 'rgba(255, 235, 59, 0.3)',
    'border-left': '3px solid var(--accent-color)',
  } as JSX.CSSProperties,

  nodeHeaderInactive: {
    opacity: '0.4',
    filter: 'grayscale(0.3)',
  } as JSX.CSSProperties,

  nodeHeaderMultiSelected: {
    'background-color': 'rgba(59, 130, 246, 0.12)',
    'border-left': '3px solid rgba(59, 130, 246, 0.45)',
  } as JSX.CSSProperties,

  nodeHeaderDropBefore: {
    'box-shadow': 'inset 0 2px 0 var(--accent-color)',
  } as JSX.CSSProperties,

  nodeHeaderDropAfter: {
    'box-shadow': 'inset 0 -2px 0 var(--accent-color)',
  } as JSX.CSSProperties,

  nodeHeaderDropInside: {
    'background-color': 'rgba(59, 130, 246, 0.15)',
    'border-left-color': 'var(--accent-color)',
  } as JSX.CSSProperties,

  dragging: {
    opacity: '0.6',
  } as JSX.CSSProperties,

  expandButton: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: '0',
    width: '20px',
    height: '20px',
    display: 'flex',
    'align-items': 'center',
    'justify-content': 'center',
    color: 'var(--text-secondary)',
    transition: 'color 0.2s',
  } as JSX.CSSProperties,

  expandPlaceholder: {
    width: '20px',
    height: '20px',
  } as JSX.CSSProperties,

  nodeIcon: {
    display: 'flex',
    'align-items': 'center',
    'font-size': '1.1rem',
    width: '20px',
  } as JSX.CSSProperties,

  nodeTitle: {
    flex: '1',
    'font-size': '0.9rem',
    'white-space': 'nowrap',
    overflow: 'hidden',
    'text-overflow': 'ellipsis',
  } as JSX.CSSProperties,

  indicatorIcon: {
    display: 'inline-flex',
    'align-items': 'center',
    'margin-left': '4px',
    'font-size': '0.9em',
    opacity: '0.8',
    cursor: 'pointer',
    transition: 'transform 0.2s ease, opacity 0.2s ease',
  } as JSX.CSSProperties,

  nodeActions: {
    display: 'flex',
    gap: '0.25rem',
    opacity: '0',
    transition: 'opacity 0.2s',
  } as JSX.CSSProperties,

  nodeActionsVisible: {
    opacity: '1',
  } as JSX.CSSProperties,

  actionButton: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: '0.25rem',
    color: 'var(--text-secondary)',
    display: 'flex',
    'align-items': 'center',
    'border-radius': '4px',
    transition: 'all 0.2s',
  } as JSX.CSSProperties,

  menuContainer: {
    position: 'relative',
  } as JSX.CSSProperties,

  dropdownMenu: {
    background: 'var(--bg-primary)',
    color: 'var(--text-primary)',
    border: '1px solid var(--border-color)',
    'border-radius': '4px',
    'box-shadow': '0 2px 8px rgba(0, 0, 0, 0.15)',
    padding: '0.25rem',
  } as JSX.CSSProperties,

  dropdownButton: {
    display: 'flex',
    'align-items': 'center',
    color: 'var(--text-primary)',
    gap: '0.5rem',
    width: '100%',
    padding: '0.5rem',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    'text-align': 'left',
    'border-radius': '4px',
    transition: 'background-color 0.2s',
    'white-space': 'nowrap',
  } as JSX.CSSProperties,

  deleteButton: {
    color: 'var(--error-color)',
  } as JSX.CSSProperties,

  editInput: {
    flex: '1',
    padding: '0.25rem',
    border: '1px solid var(--accent-color)',
    'border-radius': '4px',
    background: 'var(--bg-primary)',
    color: 'var(--text-primary)',
    'font-size': '0.9rem',
  } as JSX.CSSProperties,

  emptyState: {
    display: 'flex',
    'flex-direction': 'column',
    'align-items': 'center',
    'justify-content': 'center',
    padding: '1rem',
    color: 'var(--text-secondary)',
    'min-height': '100px',
  } as JSX.CSSProperties,

  footer: {
    padding: '0.5rem',
    'border-top': '1px solid var(--border-color)',
    background: 'var(--bg-tertiary)',
  } as JSX.CSSProperties,

  footerButtons: {
    display: 'flex',
    gap: '0.5rem',
    'flex-wrap': 'wrap',
  } as JSX.CSSProperties,

  addButton: {
    display: 'flex',
    'align-items': 'center',
    gap: '0.5rem',
    flex: '1',
    padding: '0.5rem',
    background: 'var(--bg-secondary)',
    border: '1px dashed var(--border-color)',
    'border-radius': '4px',
    cursor: 'pointer',
    color: 'var(--text-secondary)',
    transition: 'all 0.2s',
  } as JSX.CSSProperties,

  loadingIndicator: {
    display: 'inline-flex',
    'align-items': 'center',
    'margin-left': '0.5rem',
    color: 'var(--accent-color)',
  } as JSX.CSSProperties,

  spinner: {
    display: 'inline-block',
    animation: 'spin 1s linear infinite',
    'font-size': '1.2rem',
  } as JSX.CSSProperties,

  dragPreview: {
    position: 'fixed',
    top: '0',
    left: '0',
    'pointer-events': 'none',
    padding: '0.35rem 0.6rem',
    'border-radius': '8px',
    background: 'rgba(30, 41, 59, 0.92)',
    color: 'var(--text-primary)',
    'box-shadow': '0 10px 30px rgba(15, 23, 42, 0.35)',
    display: 'flex',
    'flex-direction': 'column',
    gap: '0.125rem',
    'font-size': '0.8rem',
    'z-index': 2000,
  } as JSX.CSSProperties,
}

interface NodeItemProps {
  treeNode: TreeNode
  level: number
  onSelectChapter?: () => void
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
  const [showMenu, setShowMenu] = createSignal(false)
  const [isEditing, setIsEditing] = createSignal(false)
  const [menuPosition, setMenuPosition] = createSignal({ top: 0, left: 0 })
  const [menuWidth, setMenuWidth] = createSignal(220)
  const [menuMaxHeight, setMenuMaxHeight] = createSignal(320)
  let menuButtonRef: HTMLButtonElement | undefined
  let menuRef: HTMLDivElement | undefined
  let dragPreviewEl: HTMLDivElement | null = null

  // Get the Ollama hook for summary generation
  const { generateNodeSummary } = useOllama()

  // Get the reactive node directly from store hash map
  const node = () => nodeStore.nodes[props.treeNode.id]

  const [editTitle, setEditTitle] = createSignal(node()?.title || '')
  const isDragging = () => draggingIds().includes(props.treeNode.id)
  const isMultiSelected = () => selectedIds().includes(props.treeNode.id)
  const isDropTarget = () => dropTarget()?.nodeId === props.treeNode.id
  const dropPosition = () => dropTarget()?.position

  const isExpanded = () => nodeStore.isExpanded(props.treeNode.id)
  const isSelected = () => nodeStore.selectedNodeId === props.treeNode.id
  const hasChildren = () => props.treeNode.children.length > 0
  const isActive = () => messagesStore.isNodeActive(props.treeNode.id)

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

  // Check if chapter has content but no summary
  const needsSummary = () => {
    const n = node()
    if (!n || n.type !== 'chapter') return false

    // Check if node has a summary
    const summary = n.summary
    if (summary && summary.trim().length > 0) return false

    // Check if chapter has any messages with content
    const chapterMessages = messagesStore.messages.filter(
      (msg) =>
        (msg.nodeId === props.treeNode.id || msg.chapterId === props.treeNode.id) &&
        msg.role === 'assistant' &&
        !msg.isQuery &&
        msg.content &&
        msg.content.trim().length > 0,
    )

    return chapterMessages.length > 0
  }

  // Check if chapter has any branch messages
  const hasBranches = () => {
    const n = node()
    if (!n || n.type !== 'chapter') return false

    // Use pre-computed Set for O(1) lookup instead of filtering all messages
    return messagesStore.hasNodeBranches(props.treeNode.id)
  }

  // Check if scene is missing a storyTime
  const needsStoryTime = () => {
    const n = node()
    if (!n || n.type !== 'scene') return false
    return n.storyTime === undefined || n.storyTime === null
  }

  // Check if chapter matches the active storyline filter
  const matchesStorylineFilter = () => {
    const selectedId = navigationStore.selectedStorylineId
    if (!selectedId) return false // No filter active

    const n = node()
    if (!n || n.type !== 'chapter') return false

    return (n.activeContextItemIds || []).includes(selectedId)
  }

  // Get word count for this chapter (pre-calculated by backend)
  const wordCount = () => {
    const n = node()
    if (!n || n.type !== 'chapter') return 0
    return n.wordCount || 0
  }

  // Determine color based on word count relative to average
  const getWordCountColor = () => {
    const n = node()
    if (!n || n.type !== 'chapter') return undefined
    const count = wordCount()
    if (count === 0) return '#6b7280' // gray for empty chapters

    const stats = statsStore.wordCountStats
    if (stats.average === 0) return '#22c55e' // green if no baseline

    const ratio = count / stats.average

    if (ratio >= 1.5) return '#ef4444' // red for very long chapters
    if (ratio >= 1.0) return '#f97316' // orange for above average
    if (ratio >= 0.5) return '#eab308' // yellow for average
    return '#22c55e' // green for short chapters
  }

  // Get the icon based on includeInFull state
  const getIncludeIcon = () => {
    const n = node()
    const includeVal = n?.includeInFull ?? 1 // default to summary
    switch (includeVal) {
      case 0:
        return <FaRegularCircle /> // Not included
      case 1:
        return <FaSolidCircleHalfStroke /> // Summary only
      case 2:
        return <FaSolidCircleCheck /> // Full content
      default:
        return <FaSolidCircleHalfStroke />
    }
  }

  // Get tooltip text based on includeInFull state
  const getIncludeTooltip = () => {
    const count = wordCount()
    const n = node()
    const includeVal = n?.includeInFull ?? 1
    const stateText = includeVal === 0 ? 'Not included' : includeVal === 2 ? 'Full content' : 'Summary only'
    return `${count.toLocaleString()} words • ${stateText}\nClick to cycle`
  }

  // Cycle through includeInFull states: 1 -> 2 -> 0 -> 1
  const handleCycleInclude = (e: MouseEvent) => {
    e.stopPropagation()
    const n = node()
    if (!n || n.type !== 'chapter') return

    const currentVal = n.includeInFull ?? 1
    let nextVal: number
    if (currentVal === 1)
      nextVal = 2 // summary -> full
    else if (currentVal === 2)
      nextVal = 0 // full -> not included
    else nextVal = 1 // not included -> summary

    nodeStore.updateNode(props.treeNode.id, { includeInFull: nextVal })
  }

  const getIcon = () => {
    const n = node()
    if (!n) return null
    switch (n.type) {
      case 'book':
        return <BsBook />
      case 'arc':
        return <FaSolidBookOpen />
      case 'chapter':
        return <BsBook />
      case 'scene':
        return <BsFileText /> // Different icon for scenes
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

    // Only select scene nodes (scenes contain the actual content/messages)
    if (n.type === 'scene') {
      nodeStore.selectNode(props.treeNode.id)
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
    let childType: NodeType
    switch (n.type) {
      case 'book':
        childType = 'arc'
        break
      case 'arc':
        childType = 'chapter'
        break
      case 'chapter':
        childType = 'scene'
        break
      default:
        return // Scenes can't have children (messages are separate)
    }
    nodeStore.addNode(props.treeNode.id, childType)
  }

  const handleEdit = (e: MouseEvent) => {
    e.stopPropagation()
    const n = node()
    if (!n) return
    setIsEditing(true)
    setEditTitle(n.title)
    setShowMenu(false)
  }

  const handleCopyAsMarkdown = async (e: MouseEvent) => {
    e.stopPropagation()
    const n = node()
    if (!n) return

    const markdown = buildNodeMarkdown(n.id)
    if (!markdown) {
      alert('No story content available to copy yet.')
      return
    }

    if (!navigator.clipboard) {
      copyPreviewStore.showFallbackDialog(markdown)
      setShowMenu(false)
      return
    }

    try {
      await navigator.clipboard.writeText(markdown)
      setShowMenu(false)
    } catch (error) {
      console.error('Failed to copy node as Markdown:', error)
      copyPreviewStore.showFallbackDialog(markdown)
    }
  }

  const handleCopyPreviousContext = async (e: MouseEvent) => {
    e.stopPropagation()
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

    setShowMenu(false)
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

  const updateMenuLayout = () => {
    if (!menuButtonRef || !menuRef) return

    const rect = menuButtonRef.getBoundingClientRect()
    const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 1024
    const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 768
    const isMobile = viewportWidth <= 640 // Mobile breakpoint
    const horizontalMargin = 16
    const minBottomMargin = 10 // Ensure at least 10px from bottom
    const minWidth = 220
    const maxWidth = 360

    // Calculate width
    const calculatedWidth = Math.min(Math.max(minWidth, viewportWidth - horizontalMargin * 2), maxWidth)
    const maxLeft = viewportWidth - calculatedWidth - horizontalMargin
    const preferredLeft = rect.right - calculatedWidth
    const clampedLeft = Math.min(Math.max(preferredLeft, horizontalMargin), Math.max(horizontalMargin, maxLeft))
    setMenuWidth(calculatedWidth)

    // Get both actual content height (scrollHeight) and rendered height (offsetHeight)
    const dropdownElement = menuRef
    const scrollHeight = dropdownElement?.scrollHeight ?? 0
    const offsetHeight = dropdownElement?.offsetHeight ?? 0

    // Use scrollHeight to determine true content size (important when max-height limits display)
    const actualContentHeight = scrollHeight > 0 ? scrollHeight : offsetHeight

    // Calculate available space
    const spaceBelow = viewportHeight - rect.bottom - minBottomMargin
    const spaceAbove = rect.top - minBottomMargin
    const maxAvailableHeight = Math.max(120, viewportHeight - minBottomMargin * 2)

    let maxHeight: number
    let top: number

    // On mobile, account for potentially larger content due to static positioning of NodeStatusMenu
    const estimatedHeight = isMobile && actualContentHeight > 0 ? actualContentHeight : actualContentHeight || 200

    // Check if content fits below
    const fitsBelow = spaceBelow >= estimatedHeight
    const fitsAbove = spaceAbove >= estimatedHeight

    if (fitsBelow || (!fitsAbove && spaceBelow >= spaceAbove)) {
      // Place below the button
      top = rect.bottom + 4
      maxHeight = Math.min(spaceBelow, maxAvailableHeight)

      // If using actual measurements, ensure we don't fall off screen
      if (actualContentHeight > 0) {
        const dropdownBottom = top + Math.min(actualContentHeight, maxHeight)
        const maxAllowedBottom = viewportHeight - minBottomMargin

        if (dropdownBottom > maxAllowedBottom) {
          // Adjust top to keep dropdown on screen
          const adjustment = dropdownBottom - maxAllowedBottom
          top = Math.max(rect.bottom + 4, top - adjustment)

          // If we can't keep it attached to button, consider flipping
          if (top > rect.bottom + 4 && spaceAbove > spaceBelow) {
            // Flip to above
            maxHeight = Math.min(spaceAbove, maxAvailableHeight)
            top = rect.top - Math.min(actualContentHeight, maxHeight) - 4
            top = Math.max(minBottomMargin, top)
          }
        }
      }
    } else {
      // Place above the button
      maxHeight = Math.min(spaceAbove, maxAvailableHeight)
      const dropdownHeight = Math.min(estimatedHeight, maxHeight)
      top = rect.top - dropdownHeight - 4
      top = Math.max(minBottomMargin, top)
    }

    // Final safety check: ensure dropdown doesn't extend past viewport bottom
    if (actualContentHeight > 0) {
      const finalBottom = top + Math.min(actualContentHeight, maxHeight)
      const maxBottom = viewportHeight - minBottomMargin

      if (finalBottom > maxBottom) {
        // Force adjust top to maintain bottom margin
        top = Math.min(top, maxBottom - Math.min(actualContentHeight, maxHeight))
        top = Math.max(minBottomMargin, top)
      }
    }

    setMenuMaxHeight(maxHeight)
    setMenuPosition({
      top,
      left: clampedLeft,
    })
  }

  createEffect(() => {
    if (showMenu()) {
      updateMenuLayout()
      if (typeof window !== 'undefined') {
        window.requestAnimationFrame(() => {
          updateMenuLayout()
          // Additional update after content settles
          setTimeout(() => updateMenuLayout(), 100)
        })
      } else {
        setTimeout(() => updateMenuLayout(), 0)
      }
    }
  })

  onMount(() => {
    const handleResize = () => {
      if (showMenu()) {
        updateMenuLayout()
      }
    }
    window.addEventListener('resize', handleResize)
    onCleanup(() => window.removeEventListener('resize', handleResize))
  })

  onCleanup(() => {
    if (dragPreviewEl?.parentNode) {
      dragPreviewEl.parentNode.removeChild(dragPreviewEl)
    }
    dragPreviewEl = null
  })

  const handleDelete = (e: MouseEvent) => {
    e.stopPropagation()
    const n = node()
    if (!n) return
    if (confirm(`Delete ${n.type} "${n.title}" and all its contents?`)) {
      nodeStore.deleteNode(props.treeNode.id)
    }
    setShowMenu(false)
  }

  const handleMoveUp = (e: MouseEvent) => {
    e.stopPropagation()
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
    setShowMenu(false)
  }

  const handleMoveDown = (e: MouseEvent) => {
    e.stopPropagation()
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
    setShowMenu(false)
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

  const handleGenerateSummary = async (e: MouseEvent) => {
    e.stopPropagation()
    setShowMenu(false)

    try {
      await nodeStore.generateNodeSummary(props.treeNode.id, generateNodeSummary)
    } catch (error) {
      console.error('Failed to generate summary:', error)
      alert(`Failed to generate summary: ${error instanceof Error ? error.message : 'Unknown error'}`)
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

  // Compute header style based on state
  const getNodeHeaderStyle = (): JSX.CSSProperties => {
    let style: JSX.CSSProperties = { ...navStyles.nodeHeader, 'padding-left': `${props.level * 16 + 4}px` }

    if (isSelected() && node()?.includeInFull === 2) {
      style = { ...style, ...navStyles.nodeHeaderSelectedIncludeInFull }
    } else if (isSelected()) {
      style = { ...style, ...navStyles.nodeHeaderSelected }
    } else if (node()?.includeInFull === 2) {
      style = { ...style, ...navStyles.nodeHeaderIncludeInFull }
    }

    if (!isActive()) {
      style = { ...style, ...navStyles.nodeHeaderInactive }
    }

    if (isDragging()) {
      style = { ...style, ...navStyles.dragging }
    }

    if (isMultiSelected()) {
      style = { ...style, ...navStyles.nodeHeaderMultiSelected }
    }

    if (isDropTarget()) {
      if (dropPosition() === 'before') {
        style = { ...style, ...navStyles.nodeHeaderDropBefore }
      } else if (dropPosition() === 'after') {
        style = { ...style, ...navStyles.nodeHeaderDropAfter }
      } else if (dropPosition() === 'inside') {
        style = { ...style, ...navStyles.nodeHeaderDropInside }
      }
    }

    return style
  }

  return (
    <div style={isDragging() ? { ...navStyles.nodeItem, ...navStyles.dragging } : navStyles.nodeItem}>
      <div
        class={styles.nodeHeader}
        style={getNodeHeaderStyle()}
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
            {isExpanded() ? <BsChevronDown /> : <BsChevronRight />}
          </button>
        </Show>
        <Show when={!hasChildren()}>
          <div style={navStyles.expandPlaceholder} />
        </Show>

        <span style={navStyles.nodeIcon}>{getIcon()}</span>

        <Show when={!isEditing()}>
          <span
            style={{
              ...navStyles.nodeTitle,
              color: matchesStorylineFilter() ? 'var(--primary-color)' : getStatusColor(),
            }}
            title={`ID: ${props.treeNode.id}`}
          >
            {node()?.title}{' '}
            <span style={{ opacity: 0.5, 'font-size': '0.8em' }}>({props.treeNode.id.slice(0, 8)})</span>
          </span>

        </Show>

        <Show when={isEditing()}>
          <input
            style={navStyles.editInput}
            value={editTitle()}
            onInput={(e) => setEditTitle(e.currentTarget.value)}
            onClick={(e) => e.stopPropagation()}
            onKeyPress={(e) => {
              if (e.key === 'Enter') handleSaveEdit()
              if (e.key === 'Escape') handleCancelEdit()
            }}
            onBlur={handleSaveEdit}
            autofocus
          />
        </Show>

        <div class={styles.nodeControls}>
          <div class={styles.nodeIndicators}>
            <Show when={hasScriptChanges()}>
              <span
                title={getScriptChangesTooltip()}
                style={{
                  ...navStyles.indicatorIcon,
                  color: '#9333ea',
                }}
              >
                <VsCode />
              </span>
            </Show>

            <Show when={hasBranches()}>
              <span
                title="This chapter contains branch points"
                style={{
                  ...navStyles.indicatorIcon,
                  color: '#06b6d4',
                }}
              >
                <BsDiagram3 />
              </span>
            </Show>

            <Show when={needsStoryTime()}>
              <span
                title="This scene doesn't have a storyTime set"
                style={{
                  ...navStyles.indicatorIcon,
                  color: '#ef4444',
                }}
              >
                <BsClock />
              </span>
            </Show>

            <Show when={needsSummary()}>
              <span
                title="This chapter has content but no summary"
                style={{
                  ...navStyles.indicatorIcon,
                  color: '#f59e0b',
                }}
              >
                <BsExclamationTriangle />
              </span>
            </Show>

            <Show when={node()?.type === 'chapter'}>
              <span
                title={getIncludeTooltip()}
                style={{
                  ...navStyles.indicatorIcon,
                  color: getWordCountColor(),
                  'font-size': '1em',
                }}
                onClick={handleCycleInclude}
              >
                {getIncludeIcon()}
              </span>
            </Show>

            <Show when={node()?.isSummarizing}>
              <span style={navStyles.loadingIndicator} title="Generating summary...">
                <span style={navStyles.spinner}>⟳</span>
              </span>
            </Show>
          </div>

          <div class={styles.nodeActions}>
          <Show when={node()?.type !== 'scene'}>
            <button
              class={styles.actionButton}
              onClick={handleAddChild}
              title={`Add ${node()?.type === 'book' ? 'Arc' : node()?.type === 'arc' ? 'Chapter' : 'Scene'}`}
            >
              <BsPlusCircle />
            </button>
          </Show>

          <div style={navStyles.menuContainer}>
            <button
              class={styles.actionButton}
              ref={menuButtonRef}
              onClick={(e) => {
                e.stopPropagation()
                setShowMenu((prev) => !prev)
              }}
            >
              <BsThreeDots />
            </button>

            <Portal>
              <Show when={showMenu()}>
                <div
                  class={styles.dropdownMenu}
                  style={{
                    position: 'fixed',
                    top: `${menuPosition().top}px`,
                    left: `${menuPosition().left}px`,
                    width: `${menuWidth()}px`,
                    'max-height': `${menuMaxHeight()}px`,
                    'overflow-y': 'auto',
                    'z-index': 1000,
                  }}
                  ref={(el) => {
                    menuRef = el
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <button class={styles.dropdownButton} onClick={handleEdit}>
                    <BsPencil /> Edit Title
                  </button>
                  <Show when={node()?.type === 'book' || node()?.type === 'arc' || node()?.type === 'chapter'}>
                    <button class={styles.dropdownButton} onClick={handleCopyAsMarkdown}>
                      <BsFileEarmarkText /> Copy as Markdown
                    </button>
                  </Show>
                  <Show when={node()?.type === 'chapter'}>
                    <button class={styles.dropdownButton} onClick={handleCopyPreviousContext}>
                      <BsFileEarmarkTextFill /> Copy Previous Context
                    </button>
                    <button
                      class={styles.dropdownButton}
                      onClick={(e) => {
                        console.log('[StoryNavigation] Summary button clicked')
                        handleGenerateSummary(e)
                      }}
                      disabled={node()?.isSummarizing}
                      title={node()?.summary ? 'Regenerate summary' : 'Generate summary'}
                    >
                      <Show when={!node()?.isSummarizing}>
                        <Show
                          when={node()?.summary}
                          fallback={
                            <>
                              <BsFileText /> Generate Summary
                            </>
                          }
                        >
                          <BsCheckCircle /> Regenerate Summary
                        </Show>
                      </Show>
                      <Show when={node()?.isSummarizing}>
                        <span>Generating...</span>
                      </Show>
                    </button>
                    <div>
                      <NodeStatusMenu
                        currentStatus={node()?.status}
                        onSelect={(status) => nodeStore.updateNode(props.treeNode.id, { status })}
                        onOptionSelected={() => setShowMenu(false)}
                        parentMenuOpen={showMenu}
                        onLayoutChange={updateMenuLayout}
                      />
                    </div>
                    <button
                      class={styles.dropdownButton}
                      onClick={(e) => {
                        e.stopPropagation()
                        nodeStore.setIncludeForPrecedingChapters(props.treeNode.id, 1)
                        setShowMenu(false)
                      }}
                      title="Set all chapters before this one to use summaries in context"
                    >
                      <FaSolidCircleHalfStroke /> Use Summaries Before
                    </button>
                    <button
                      class={styles.dropdownButton}
                      onClick={(e) => {
                        e.stopPropagation()
                        nodeStore.setIncludeForPrecedingChapters(props.treeNode.id, 0)
                        setShowMenu(false)
                      }}
                      title="Exclude all chapters before this one from context"
                    >
                      <FaRegularCircle /> Exclude All Before
                    </button>
                  </Show>
                  <button
                    class={styles.dropdownButton}
                    onClick={() => {
                      const n = node()
                      if (!n) return
                      nodeStore.insertNodeBefore(props.treeNode.id, n.type)
                      setShowMenu(false)
                    }}
                  >
                    <BsPlusCircle /> Insert{' '}
                    {node()?.type === 'book'
                      ? 'Book'
                      : node()?.type === 'arc'
                        ? 'Arc'
                        : node()?.type === 'chapter'
                          ? 'Chapter'
                          : 'Scene'}{' '}
                    Before
                  </button>
                  <Show when={canMoveUp()}>
                    <button class={styles.dropdownButton} onClick={handleMoveUp}>
                      <BsArrowUp /> Move Up
                    </button>
                  </Show>
                  <Show when={canMoveDown()}>
                    <button class={styles.dropdownButton} onClick={handleMoveDown}>
                      <BsArrowDown /> Move Down
                    </button>
                  </Show>
                  <button class={`${styles.dropdownButton} ${styles.deleteButton}`} onClick={handleDelete}>
                    <BsTrash /> Delete
                  </button>
                </div>
              </Show>
            </Portal>
          </div>
        </div>
        </div>
      </div>

      <Show when={isExpanded() && hasChildren()}>
        <div style={{ 'margin-left': '8px' }}>
          <For each={props.treeNode.children}>
            {(child) => <NodeItem treeNode={child} level={props.level + 1} onSelectChapter={props.onSelectChapter} />}
          </For>
        </div>
      </Show>
    </div>
  )
}

interface StoryNavigationProps {
  onSelectChapter?: () => void
}

export const StoryNavigation: Component<StoryNavigationProps> = (props) => {
  let treeContainerRef: HTMLDivElement | undefined

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
      <div style={navStyles.navigation}>
        <div style={navStyles.treeContainer} ref={treeContainerRef}>
          <For each={nodeStore.tree}>
            {(treeNode) => <NodeItem treeNode={treeNode} level={0} onSelectChapter={props.onSelectChapter} />}
          </For>

          <Show when={nodeStore.tree.length === 0}>
            <div style={navStyles.emptyState}>
              <p>No books yet</p>
              <button style={navStyles.addButton} onClick={handleAddBook}>
                <BsPlusCircle /> Add Book
              </button>
            </div>
          </Show>
        </div>

        <Show when={nodeStore.tree.length > 0}>
          <div style={navStyles.footer}>
            <div style={navStyles.footerButtons}>
              <button style={navStyles.addButton} onClick={handleCopyTreeMarkdown}>
                <BsDiagram3 /> Copy Tree as Markdown
              </button>
              <button style={navStyles.addButton} onClick={handleAddBook}>
                <BsPlusCircle /> Add Book
              </button>
            </div>
          </div>
        </Show>
      </div>
    </TreeDragDropProvider>
  )
}
