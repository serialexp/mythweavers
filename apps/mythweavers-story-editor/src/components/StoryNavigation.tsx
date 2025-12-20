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
import { Dropdown, DropdownItem } from '@mythweavers/ui'
import { Component, For, Show, createEffect, createSignal, onCleanup, onMount } from 'solid-js'
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
  const [isEditing, setIsEditing] = createSignal(false)
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

  const handleEdit = () => {
    const n = node()
    if (!n) return
    setIsEditing(true)
    setEditTitle(n.title)
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

  const handleDelete = () => {
    const n = node()
    if (!n) return
    if (confirm(`Delete ${n.type} "${n.title}" and all its contents?`)) {
      nodeStore.deleteNode(props.treeNode.id)
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

  // Compute header classes based on state
  const getNodeHeaderClasses = (): string => {
    const classes = [styles.nodeHeader]

    if (isSelected() && node()?.includeInFull === 2) {
      classes.push(styles.nodeHeaderSelectedIncludeInFull)
    } else if (isSelected()) {
      classes.push(styles.nodeHeaderSelected)
    } else if (node()?.includeInFull === 2) {
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
        style={{ 'padding-left': `${props.level * 16 + 4}px` }}
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
          <div class={styles.expandPlaceholder} />
        </Show>

        <span class={styles.nodeIcon}>{getIcon()}</span>

        <Show when={!isEditing()}>
          <span
            class={styles.nodeTitle}
            style={{ color: matchesStorylineFilter() ? 'var(--primary-color)' : getStatusColor() }}
            title={`ID: ${props.treeNode.id}`}
          >
            {node()?.title}{' '}
            <span style={{ opacity: 0.5, 'font-size': '0.8em' }}>({props.treeNode.id.slice(0, 8)})</span>
          </span>
        </Show>

        <Show when={isEditing()}>
          <input
            class={styles.editInput}
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
                class={styles.indicatorIcon}
                title={getScriptChangesTooltip()}
                style={{ color: '#9333ea' }}
              >
                <VsCode />
              </span>
            </Show>

            <Show when={hasBranches()}>
              <span
                class={styles.indicatorIcon}
                title="This chapter contains branch points"
                style={{ color: '#06b6d4' }}
              >
                <BsDiagram3 />
              </span>
            </Show>

            <Show when={needsStoryTime()}>
              <span
                class={styles.indicatorIcon}
                title="This scene doesn't have a storyTime set"
                style={{ color: '#ef4444' }}
              >
                <BsClock />
              </span>
            </Show>

            <Show when={needsSummary()}>
              <span
                class={styles.indicatorIcon}
                title="This chapter has content but no summary"
                style={{ color: '#f59e0b' }}
              >
                <BsExclamationTriangle />
              </span>
            </Show>

            <Show when={node()?.type === 'chapter'}>
              <span
                class={styles.indicatorIcon}
                title={getIncludeTooltip()}
                style={{ color: getWordCountColor(), 'font-size': '1em' }}
                onClick={handleCycleInclude}
              >
                {getIncludeIcon()}
              </span>
            </Show>

            <Show when={node()?.isSummarizing}>
              <span class={styles.loadingIndicator} title="Generating summary...">
                <span class={styles.spinner}>⟳</span>
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

          <Dropdown
            portal
            alignRight
            trigger={
              <button class={styles.actionButton}>
                <BsThreeDots />
              </button>
            }
          >
            <DropdownItem icon={<BsPencil />} onClick={handleEdit}>
              Edit Title
            </DropdownItem>
            <Show when={node()?.type === 'book' || node()?.type === 'arc' || node()?.type === 'chapter'}>
              <DropdownItem icon={<BsFileEarmarkText />} onClick={handleCopyAsMarkdown}>
                Copy as Markdown
              </DropdownItem>
            </Show>
            <Show when={node()?.type === 'chapter'}>
              <DropdownItem icon={<BsFileEarmarkTextFill />} onClick={handleCopyPreviousContext}>
                Copy Previous Context
              </DropdownItem>
              <DropdownItem
                icon={
                  node()?.isSummarizing ? undefined : node()?.summary ? <BsCheckCircle /> : <BsFileText />
                }
                onClick={handleGenerateSummary}
                disabled={node()?.isSummarizing}
              >
                {node()?.isSummarizing
                  ? 'Generating...'
                  : node()?.summary
                    ? 'Regenerate Summary'
                    : 'Generate Summary'}
              </DropdownItem>
              <NodeStatusMenu
                currentStatus={node()?.status}
                onSelect={(status) => nodeStore.updateNode(props.treeNode.id, { status })}
              />
              <DropdownItem
                icon={<FaSolidCircleHalfStroke />}
                onClick={() => nodeStore.setIncludeForPrecedingChapters(props.treeNode.id, 1)}
              >
                Use Summaries Before
              </DropdownItem>
              <DropdownItem
                icon={<FaRegularCircle />}
                onClick={() => nodeStore.setIncludeForPrecedingChapters(props.treeNode.id, 0)}
              >
                Exclude All Before
              </DropdownItem>
            </Show>
            <DropdownItem
              icon={<BsPlusCircle />}
              onClick={() => {
                const n = node()
                if (n) nodeStore.insertNodeBefore(props.treeNode.id, n.type)
              }}
            >
              Insert {node()?.type === 'book' ? 'Book' : node()?.type === 'arc' ? 'Arc' : node()?.type === 'chapter' ? 'Chapter' : 'Scene'} Before
            </DropdownItem>
            <Show when={canMoveUp()}>
              <DropdownItem icon={<BsArrowUp />} onClick={handleMoveUp}>
                Move Up
              </DropdownItem>
            </Show>
            <Show when={canMoveDown()}>
              <DropdownItem icon={<BsArrowDown />} onClick={handleMoveDown}>
                Move Down
              </DropdownItem>
            </Show>
            <DropdownItem icon={<BsTrash />} onClick={handleDelete} danger>
              Delete
            </DropdownItem>
          </Dropdown>
        </div>
        </div>
      </div>

      <Show when={isExpanded() && hasChildren()}>
        <div class={styles.childrenContainer}>
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
      <div class={styles.navigation}>
        <div class={styles.treeContainer} ref={treeContainerRef}>
          <For each={nodeStore.tree}>
            {(treeNode) => <NodeItem treeNode={treeNode} level={0} onSelectChapter={props.onSelectChapter} />}
          </For>

          <Show when={nodeStore.tree.length === 0}>
            <div class={styles.emptyState}>
              <p>No books yet</p>
              <button class={styles.addButton} onClick={handleAddBook}>
                <BsPlusCircle /> Add Book
              </button>
            </div>
          </Show>
        </div>

        <Show when={nodeStore.tree.length > 0}>
          <div class={styles.footer}>
            <div class={styles.footerButtons}>
              <button class={styles.addButton} onClick={handleCopyTreeMarkdown}>
                <BsDiagram3 /> Copy Tree as Markdown
              </button>
              <button class={styles.addButton} onClick={handleAddBook}>
                <BsPlusCircle /> Add Book
              </button>
            </div>
          </div>
        </Show>
      </div>
    </TreeDragDropProvider>
  )
}
