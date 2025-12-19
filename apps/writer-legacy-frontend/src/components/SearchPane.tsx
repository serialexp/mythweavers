import { createEffect, createSignal } from 'solid-js'
import { searchEmbeddings } from '../lib/embeddings/embedding-store'
import { loadStoryToEmbeddings } from '../lib/embeddings/load-story-to-embeddings'
import { addNotification } from '../lib/stores/notifications'
import { plotpoints } from '../lib/stores/plot-points'
import { sortedObjects } from '../lib/stores/retrieval/sorted-objects'
import { scenesState } from '../lib/stores/scenes'
import { NoItems } from './NoItems'
import { Paragraph } from './Paragraph'

export const SearchPane = () => {
  const [search, setSearch] = createSignal('')
  const [plotpoint, setPlotpoint] = createSignal<string | null>(null)
  const [isLoadingEmbeddings, setIsLoadingEmbeddings] = createSignal(false)
  const [foundParagraphs, setFoundParagraphs] = createSignal<
    {
      sceneId: string
      paragraphId: string
    }[]
  >([])
  const [lastSearchType, _setLastSearchType] = createSignal<'text' | 'embeddings'>('text')
  createEffect(() => {
    if (search().length < 3) {
      setFoundParagraphs([])
      return
    }
  }) // Assume this is defined elsewhere

  return (
    <div class="flex flex-col gap-2 p-2 w-full h-full overflow-hidden bg-cover">
      {foundParagraphs().length > 0 ? (
        <div class="w-full px-4">
          {lastSearchType() === 'embeddings' ? (
            <div class="alert alert-warning">Search results are in order of relevance.</div>
          ) : (
            <div class="alert alert-info">Search results are in story order.</div>
          )}
        </div>
      ) : null}
      {sortedObjects().filter((o) => o.type === 'paragraph').length === 0 ? (
        <NoItems
          itemKind="paragraphs"
          suggestion="You can create a new paragraph under the 'Story' option in the header."
        />
      ) : (
        <div class="flex-1 overflow-auto">
          {foundParagraphs().length > 0
            ? foundParagraphs().map((i) => {
                const p = scenesState.scenes[i.sceneId].paragraphs.find((p) => p.id === i.paragraphId)
                if (p) {
                  return <Paragraph identifyLocation={true} sceneId={i.sceneId} paragraph={p} />
                }
              })
            : null}
        </div>
      )}
      <div class="flex flex-row gap-2">
        <input
          type="text"
          placeholder="Search"
          value={search()}
          onInput={(e) => setSearch(e.currentTarget.value)}
          class="input input-bordered w-full"
        />
        <select
          class="select select-bordered"
          value={plotpoint() ?? ''}
          onChange={(e) => setPlotpoint(e.currentTarget.value)}
        >
          {Object.values(plotpoints.plotPoints).map((p) => (
            <option value={p.id}>{p.title}</option>
          ))}
        </select>
        <button
          type="button"
          class="btn btn-primary"
          onClick={() => {
            const objects = sortedObjects()
            const found = objects
              .filter(
                (o) =>
                  o.type === 'paragraph' &&
                  (search().length === 0 || o.text.toLowerCase().includes(search().toLowerCase())) &&
                  (!plotpoint() || o.plotpointIds.includes(plotpoint() ?? '')),
              )
              .map((o) => {
                return o.type === 'paragraph'
                  ? {
                      sceneId: o.sceneId,
                      paragraphId: o.paragraphId,
                    }
                  : null
              })
            setFoundParagraphs(found.filter((o) => o !== null))
          }}
        >
          Search
        </button>
        <button
          type="button"
          class="btn btn-secondary"
          disabled={isLoadingEmbeddings()}
          onClick={() => {
            setIsLoadingEmbeddings(true)
            loadStoryToEmbeddings()
              .catch((error) => {
                console.error(error)
                addNotification({
                  message: error.message,
                  type: 'error',
                })
              })
              .then(() => {
                searchEmbeddings(search(), 10).then((results) => {
                  console.log(results)
                  const found = results.map((r) => {
                    return r[0].metadata.kind === 'content'
                      ? {
                          sceneId: r[0].metadata.sceneId,
                          paragraphId: r[0].metadata.paragraphId,
                        }
                      : null
                  })
                  setFoundParagraphs(found.filter((o) => o !== null))
                })
              })
              .finally(() => {
                setIsLoadingEmbeddings(false)
              })
              .catch((error) => {
                addNotification({
                  message: error.message,
                  type: 'error',
                })
              })
          }}
        >
          Embeddings Search
        </button>
      </div>
    </div>
  )
}
