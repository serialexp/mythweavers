import { For, Show, createEffect, createSignal, onMount } from 'solid-js'
import { scenesState } from '../../lib/stores/scenes'
import { findPathToNode, getContextNodes, getStoryNodes } from '../../lib/stores/tree'

type ContextNodeItem = {
  id: string
  name: string
  chapter: string
  nodeType: 'context' | 'story'
  wordCount?: number
}

export interface ContextNodeFinderProps {
  /**
   * Callback when selection changes
   */
  onChange: (selectedNodeIds: string[]) => void

  /**
   * Currently selected node IDs
   */
  selectedNodeIds?: string[]

  /**
   * Maximum height of the node list
   */
  maxHeight?: string

  /**
   * Whether to show the search input
   */
  showSearch?: boolean

  /**
   * Which node types to display
   */
  nodeTypes?: ('context' | 'story')[]
}

export const ContextNodeFinder = (props: ContextNodeFinderProps) => {
  const [availableNodes, setAvailableNodes] = createSignal<ContextNodeItem[]>([])
  const [selectedNodes, setSelectedNodes] = createSignal<Record<string, boolean>>({})
  const [searchQuery, setSearchQuery] = createSignal('')
  const [loading, setLoading] = createSignal(false)

  // Initialize selected nodes from props
  createEffect(() => {
    if (props.selectedNodeIds) {
      const newSelection: Record<string, boolean> = {}
      props.selectedNodeIds.forEach((id) => {
        newSelection[id] = true
      })
      setSelectedNodes(newSelection)
    }
  })

  // Load all available context and story nodes once on mount
  onMount(() => {
    loadAllNodes()
  })

  // Function to load all context and story nodes
  const loadAllNodes = () => {
    setLoading(true)

    try {
      const allNodes: ContextNodeItem[] = []
      const newSelections: Record<string, boolean> = {}

      const enabledTypes = props.nodeTypes ?? ['context', 'story']

      // Get context nodes if enabled
      if (enabledTypes.includes('context')) {
        const contextNodes = getContextNodes()
        for (const node of contextNodes) {
          const sceneData = scenesState.scenes[node.id]
          if (!sceneData) continue

          // Find the path to get chapter information
          const path = findPathToNode(node.id)
          if (!path || path.length < 3) continue

          const [_bookNode, arcNode, chapterNode] = path

          allNodes.push({
            id: node.id,
            name: node.name || sceneData.title || 'Unnamed Context Node',
            chapter: `${arcNode.name} > ${chapterNode.name}`,
            nodeType: 'context',
            wordCount: sceneData.words,
          })

          // Initialize selection state
          const wasAlreadySelected = props.selectedNodeIds?.includes(node.id) ?? false
          newSelections[node.id] = wasAlreadySelected
        }
      }

      // Get story nodes that can be used as context if enabled
      if (enabledTypes.includes('story')) {
        const storyNodes = getStoryNodes()
        for (const node of storyNodes) {
          const sceneData = scenesState.scenes[node.id]
          if (!sceneData) continue

          // Find the path to get chapter information
          const path = findPathToNode(node.id)
          if (!path || path.length < 3) continue

          const [_bookNode, arcNode, chapterNode] = path

          allNodes.push({
            id: node.id,
            name: node.name || sceneData.title || 'Unnamed Story Node',
            chapter: `${arcNode.name} > ${chapterNode.name}`,
            nodeType: 'story',
            wordCount: sceneData.words,
          })

          // Initialize selection state
          const wasAlreadySelected = props.selectedNodeIds?.includes(node.id) ?? false
          newSelections[node.id] = wasAlreadySelected
        }
      }

      // Set all nodes and selections at once
      setAvailableNodes(allNodes)
      setSelectedNodes(newSelections)

      // Notify about initial selection
      notifySelectionChange()
    } catch (error) {
      console.error('Error loading context/story nodes:', error)
    } finally {
      setLoading(false)
    }
  }

  // Filter nodes based on search query
  const filteredNodes = () => {
    const query = searchQuery().toLowerCase().trim()
    if (!query) return availableNodes()

    return availableNodes().filter(
      (node) => node.name.toLowerCase().includes(query) || node.chapter.toLowerCase().includes(query),
    )
  }

  // Group nodes by type
  const contextNodes = () => filteredNodes().filter((node) => node.nodeType === 'context')
  const storyNodes = () => filteredNodes().filter((node) => node.nodeType === 'story')

  // Toggle node selection
  const toggleNode = (id: string) => {
    setSelectedNodes((prev) => {
      const newState = { ...prev, [id]: !prev[id] }
      return newState
    })
    notifySelectionChange()
  }

  // Notify parent component about selection changes
  const notifySelectionChange = () => {
    const selectedIds = Object.entries(selectedNodes())
      .filter(([_, selected]) => selected)
      .map(([id]) => id)

    props.onChange(selectedIds)
  }

  // Helper function to select/deselect all nodes
  const selectAllNodes = (selected: boolean) => {
    const newSelection = { ...selectedNodes() }
    for (const node of availableNodes()) {
      newSelection[node.id] = selected
    }
    setSelectedNodes(newSelection)
    notifySelectionChange()
  }

  return (
    <div class="w-full bg-base-200 p-4 rounded-lg">
      <div class="flex justify-between mb-2">
        <h3 class="text-sm font-bold">Context Node Selection:</h3>
        <div class="flex gap-2">
          <button class="btn btn-xs btn-outline" onClick={() => selectAllNodes(true)}>
            Select All
          </button>
          <button class="btn btn-xs btn-outline" onClick={() => selectAllNodes(false)}>
            Deselect All
          </button>
        </div>
      </div>

      {/* Search Input */}
      <Show when={props.showSearch !== false}>
        <div class="mb-3">
          <input
            type="text"
            class="input input-bordered input-sm w-full"
            placeholder="Search context/story nodes..."
            value={searchQuery()}
            onInput={(e) => setSearchQuery(e.currentTarget.value)}
          />
        </div>
      </Show>

      {/* Loading State */}
      <Show when={loading()}>
        <div class="flex justify-center py-3">
          <span class="loading loading-spinner loading-md" />
        </div>
      </Show>

      {/* Node List */}
      <Show when={!loading()}>
        <div class="flex flex-col gap-1 overflow-y-auto" style={{ 'max-height': props.maxHeight || '300px' }}>
          {/* Context Nodes Section */}
          <Show when={contextNodes().length > 0}>
            <div class="font-medium text-sm mt-2 mb-1 text-secondary">Context Nodes:</div>
            <For each={contextNodes()}>
              {(node) => (
                <label class="flex items-center cursor-pointer gap-2 bg-base-100 p-2 rounded border-l-4 border-secondary">
                  <input
                    class="checkbox checkbox-sm checkbox-secondary"
                    type="checkbox"
                    checked={selectedNodes()[node.id] ?? false}
                    onChange={() => toggleNode(node.id)}
                  />
                  <span>{node.name}</span>
                  <span class="text-xs text-gray-500 ml-auto">
                    {node.wordCount ?? 0} words | {node.chapter}
                  </span>
                </label>
              )}
            </For>
          </Show>

          {/* Story Nodes Section */}
          <Show when={storyNodes().length > 0}>
            <div class="font-medium text-sm mt-2 mb-1 text-primary">Story Nodes (as Context):</div>
            <For each={storyNodes()}>
              {(node) => (
                <label class="flex items-center cursor-pointer gap-2 bg-base-100 p-2 rounded border-l-4 border-primary">
                  <input
                    class="checkbox checkbox-sm checkbox-primary"
                    type="checkbox"
                    checked={selectedNodes()[node.id] ?? false}
                    onChange={() => toggleNode(node.id)}
                  />
                  <span>{node.name}</span>
                  <span class="text-xs text-gray-500 ml-auto">
                    {node.wordCount ?? 0} words | {node.chapter}
                  </span>
                </label>
              )}
            </For>
          </Show>

          {/* No nodes found */}
          <Show when={filteredNodes().length === 0 && !loading()}>
            <div class="text-sm text-gray-500 italic p-2 text-center">No context or story nodes available</div>
          </Show>
        </div>
      </Show>
    </div>
  )
}
