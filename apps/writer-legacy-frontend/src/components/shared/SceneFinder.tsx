import { For, Show, createEffect, createSignal, onMount } from 'solid-js'
import { contentSchemaToText } from '../../lib/persistence/content-schema-to-html'
import { getOrderedSceneIds } from '../../lib/selectors/orderedSceneIds'
import { scenesState } from '../../lib/stores/scenes'
import { findPathToNode, treeState } from '../../lib/stores/tree'

type SceneItem = {
  id: string
  name: string
  chapter: string
  source: string
  wordCount?: number
}

export interface SceneFinderProps {
  /**
   * The current scene ID to use as reference (to find related scenes)
   */
  currentSceneId?: string

  /**
   * Callback when selection changes
   */
  onChange: (selectedSceneIds: string[]) => void

  /**
   * Currently selected scene IDs
   */
  selectedSceneIds?: string[]

  /**
   * Maximum height of the scene list
   */
  maxHeight?: string

  /**
   * Whether to show the search input
   */
  showSearch?: boolean
}

export const SceneFinder = (props: SceneFinderProps) => {
  const [availableScenes, setAvailableScenes] = createSignal<SceneItem[]>([])
  const [selectedScenes, setSelectedScenes] = createSignal<Record<string, boolean>>({})
  const [searchQuery, setSearchQuery] = createSignal('')
  const [loading, setLoading] = createSignal(false)

  // Initialize selected scenes from props
  createEffect(() => {
    if (props.selectedSceneIds) {
      const newSelection: Record<string, boolean> = {}
      props.selectedSceneIds.forEach((id) => {
        newSelection[id] = true
      })
      setSelectedScenes(newSelection)
    }
  })

  // Load all available scenes in the story once on mount
  onMount(() => {
    loadAllScenes()
  })

  // Function to load all scenes
  const loadAllScenes = () => {
    setLoading(true)

    try {
      const allScenes: SceneItem[] = []
      const newSelections: Record<string, boolean> = {}

      // Get all scene IDs from the story structure
      const orderedSceneIds = getOrderedSceneIds(treeState.structure)

      // Process each scene
      for (const sceneId of orderedSceneIds) {
        const sceneData = scenesState.scenes[sceneId]
        if (!sceneData) continue

        // Find the path to get book/arc/chapter information
        const path = findPathToNode(sceneId)
        if (!path || path.length < 3) continue

        const [bookNode, arcNode, chapterNode] = path
        const book = treeState.structure.find((b) => b.id === bookNode.id)
        const arc = book?.children?.find((a) => a.id === arcNode.id)
        const chapter = arc?.children?.find((c) => c.id === chapterNode.id)
        if (!book || !arc || !chapter) continue

        const sceneNode = chapter.children?.find((s) => s.id === sceneId)
        if (!sceneNode) continue

        // Create the scene item
        allScenes.push({
          id: sceneId,
          name: sceneNode.name || sceneData.title || 'Unnamed Scene',
          chapter: `${arc.name} > ${chapter.name}`,
          source: book.name,
          wordCount: sceneData.words,
        })

        // Initialize scene selection state
        const isCurrentScene = sceneId === props.currentSceneId
        const wasAlreadySelected = props.selectedSceneIds?.includes(sceneId) ?? false
        newSelections[sceneId] = isCurrentScene || wasAlreadySelected
      }

      // Set all scenes and selections at once
      setAvailableScenes(allScenes)
      setSelectedScenes(newSelections)

      // Notify about initial selection
      notifySelectionChange()
    } catch (error) {
      console.error('Error loading scenes:', error)
    } finally {
      setLoading(false)
    }
  }

  // Filter scenes based on search query
  const filteredScenes = () => {
    const query = searchQuery().toLowerCase().trim()
    if (!query) return availableScenes()

    return availableScenes().filter(
      (scene) => scene.name.toLowerCase().includes(query) || scene.chapter.toLowerCase().includes(query),
    )
  }

  // Get unique book names - memoized to avoid recomputation
  const uniqueBooks = () => {
    const sources = new Set()
    const filtered = filteredScenes()
    const books: string[] = []

    for (const scene of filtered) {
      if (!sources.has(scene.source)) {
        sources.add(scene.source)
        books.push(scene.source)
      }
    }

    return books
  }

  // Helper function to group scenes by book - memoized to avoid filtering multiple times
  const scenesByBook = (bookName: string) => {
    return filteredScenes().filter((scene) => scene.source === bookName)
  }

  // Toggle scene selection
  const toggleScene = (id: string) => {
    setSelectedScenes((prev) => {
      const newState = { ...prev, [id]: !prev[id] }
      return newState
    })
    notifySelectionChange()
  }

  // Notify parent component about selection changes
  const notifySelectionChange = () => {
    const selectedIds = Object.entries(selectedScenes())
      .filter(([_, selected]) => selected)
      .map(([id]) => id)

    props.onChange(selectedIds)
  }

  // Helper function to select/deselect all scenes
  const selectAllScenes = (selected: boolean) => {
    const newSelection = { ...selectedScenes() }
    for (const scene of availableScenes()) {
      newSelection[scene.id] = selected
    }
    setSelectedScenes(newSelection)
    notifySelectionChange()
  }

  // Helper to get scene content (used for generated characters based on scene)
  const _getSceneContent = (sceneId: string): string => {
    const sceneData = scenesState.scenes[sceneId]
    if (!sceneData?.paragraphs) return ''

    return sceneData.paragraphs
      .map((p) => (typeof p.text === 'string' ? p.text : contentSchemaToText(p.text)))
      .join('\n\n')
  }

  return (
    <div class="w-full bg-base-200 p-4 rounded-lg">
      <div class="flex justify-between mb-2">
        <h3 class="text-sm font-bold">Scene Selection:</h3>
        <div class="flex gap-2">
          <button class="btn btn-xs btn-outline" onClick={() => selectAllScenes(true)}>
            Select All
          </button>
          <button class="btn btn-xs btn-outline" onClick={() => selectAllScenes(false)}>
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
            placeholder="Search scenes..."
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

      {/* Scene List */}
      <Show when={!loading()}>
        <div class="flex flex-col gap-1 overflow-y-auto" style={{ 'max-height': props.maxHeight || '300px' }}>
          {/* Group scenes by book */}
          <For each={uniqueBooks()}>
            {(bookName) => {
              const bookScenes = scenesByBook(bookName)
              return (
                <>
                  <Show when={bookScenes.length > 0}>
                    <div class="font-medium text-sm mt-2 mb-1">{bookName}:</div>
                    <For each={bookScenes}>
                      {(scene) => (
                        <label class="flex items-center cursor-pointer gap-2 bg-base-100 p-2 rounded">
                          <input
                            class="checkbox checkbox-sm"
                            type="checkbox"
                            checked={selectedScenes()[scene.id] ?? false}
                            onChange={() => toggleScene(scene.id)}
                          />
                          <span>{scene.name}</span>
                          <span class="text-xs text-gray-500 ml-auto">
                            {scene.wordCount ?? 0} words | {scene.chapter}
                          </span>
                        </label>
                      )}
                    </For>
                  </Show>
                </>
              )
            }}
          </For>

          {/* No scenes found */}
          <Show when={filteredScenes().length === 0 && !loading()}>
            <div class="text-sm text-gray-500 italic p-2 text-center">No scenes available</div>
          </Show>
        </div>
      </Show>
    </div>
  )
}
