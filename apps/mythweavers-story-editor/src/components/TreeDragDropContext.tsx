import { Accessor, Component, JSX, createContext, createSignal, useContext } from 'solid-js'

export type DropPosition = 'before' | 'after' | 'inside'

export interface DropTarget {
  nodeId: string
  position: DropPosition
}

interface TreeDragDropContextValue {
  draggingIds: Accessor<string[]>
  dropTarget: Accessor<DropTarget | null>
  selectedIds: Accessor<string[]>
  startDrag: (nodeIds: string[]) => void
  setSelection: (nodeIds: string[]) => void
  toggleSelection: (nodeId: string) => void
  clearSelection: () => void
  setDropTarget: (target: DropTarget | null) => void
  endDrag: () => void
}

const TreeDragDropContext = createContext<TreeDragDropContextValue>()

export const TreeDragDropProvider: Component<{ children: JSX.Element }> = (props) => {
  const [draggingIds, setDraggingIds] = createSignal<string[]>([])
  const [dropTarget, setDropTarget] = createSignal<DropTarget | null>(null)
  const [selectedIds, setSelectedIds] = createSignal<string[]>([])

  const startDrag = (nodeIds: string[]) => {
    const uniqueIds = Array.from(new Set(nodeIds))
    setDraggingIds(uniqueIds)
  }

  const setSelection = (nodeIds: string[]) => {
    const uniqueIds = Array.from(new Set(nodeIds))
    setSelectedIds(uniqueIds)
  }

  const toggleSelection = (nodeId: string) => {
    setSelectedIds((prev) => {
      if (prev.includes(nodeId)) {
        return prev.filter((id) => id !== nodeId)
      }
      return [...prev, nodeId]
    })
  }

  const clearSelection = () => {
    setSelectedIds([])
  }

  const endDrag = () => {
    setDraggingIds([])
    setDropTarget(null)
  }

  return (
    <TreeDragDropContext.Provider
      value={{
        draggingIds,
        dropTarget,
        selectedIds,
        startDrag,
        setSelection,
        toggleSelection,
        clearSelection,
        setDropTarget,
        endDrag,
      }}
    >
      {props.children}
    </TreeDragDropContext.Provider>
  )
}

export const useTreeDragDrop = () => {
  const context = useContext(TreeDragDropContext)
  if (!context) {
    throw new Error('useTreeDragDrop must be used within a TreeDragDropProvider')
  }
  return context
}
