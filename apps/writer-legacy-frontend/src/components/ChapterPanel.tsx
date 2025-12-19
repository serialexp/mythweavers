import { Show, createSignal } from 'solid-js'
import { booksStore } from '../lib/stores/books'
import { deleteChapter, updateChapter } from '../lib/stores/chapters'
import { currentChapter } from '../lib/stores/retrieval/current-chapter'
import { sortedObjects } from '../lib/stores/retrieval/sorted-objects'
import { findPathToNode, updateNode } from '../lib/stores/tree'
import { useAi } from '../lib/use-ai'
import { NodeTypeButtons } from './NodeTypeButtons'
import { FormField } from './styled/FormField'
// import { DateTimePicker } from "./DateTimePicker"; // DateTimePicker is not used in the overview panel

export const ChapterPanel = () => {
  const [isAiLoading, setIsAiLoading] = createSignal(false)
  const help = async (helpKind: 'suggest_title' | 'rewrite_spelling' | 'summarize', _extra = false) => {
    const chapterId = currentChapter()?.id

    if (!chapterId) {
      return
    }

    setIsAiLoading(true)
    try {
      let promptContent = ''
      if (helpKind === 'summarize') {
        const chapterContent =
          sortedObjects(chapterId, true)
            ?.filter((i) => i.type === 'paragraph')
            .map((i) => i.plainText)
            .join('\n\n') ?? ''

        let bookId: string | undefined
        const path = findPathToNode(chapterId)
        if (path.length > 0 && path[0].type === 'book') {
          bookId = path[0].id
        }

        let bookSummary = 'No book summary context available.'
        if (bookId && booksStore.books[bookId]) {
          bookSummary = booksStore.books[bookId].summary || 'Book summary is empty.'
        }

        promptContent = `<book_summary>\n${bookSummary}\n</book_summary>\n\n<chapter_scene_content>\n${chapterContent}\n</chapter_scene_content>`
      } else {
        // For other help kinds, use only the chapter's paragraphs
        promptContent =
          sortedObjects(chapterId, true)
            ?.filter((i) => i.type === 'paragraph')
            .map((i) => i.plainText)
            .join('\n\n') ?? ''
      }

      const res = await useAi(helpKind, promptContent, false)

      if (helpKind === 'suggest_title') {
        updateChapter(chapterId, {
          title: res ?? undefined,
        })
        updateNode(chapterId, {
          name: res ?? undefined,
        })
      } else if (helpKind === 'summarize') {
        updateChapter(chapterId, {
          summary: res ?? undefined,
        })
        updateNode(chapterId, {
          oneliner: res ?? undefined,
        })
      } else {
        updateChapter(chapterId, {
          extra: res,
        })
      }
    } finally {
      setIsAiLoading(false)
    }
  }

  return currentChapter() ? (
    <div class="flex-1 p-0 overflow-hidden">
      <div class="flex-1 p-4 h-full overflow-auto">
        <div>ID: {currentChapter()?.id}</div>
        <div class="form-control">
          <label class="label" for="chapter-title">
            Title
          </label>
          <input
            id="chapter-title"
            class="input input-bordered"
            placeholder="title"
            onInput={(e) => {
              const chapterId = currentChapter()?.id
              if (chapterId) {
                updateChapter(chapterId, {
                  title: e.target.value,
                })
                updateNode(chapterId, {
                  name: e.target.value,
                })
              }
            }}
            value={currentChapter()?.title ?? ''}
          />
        </div>
        <div class="form-control">
          <label class="label" for="chapter-summary">
            Summary
          </label>
          <textarea
            id="chapter-summary"
            class="textarea textarea-bordered mt-2"
            onInput={(e) => {
              const chapterId = currentChapter()?.id
              if (chapterId) {
                updateChapter(chapterId, {
                  summary: e.target.value,
                })
                updateNode(chapterId, {
                  oneliner: e.target.value,
                })
              }
            }}
            placeholder="summary"
            style={{ height: '300px' }}
            value={currentChapter()?.summary ?? ''}
          />
        </div>
        <div class="form-control">
          <label class="label" for="chapter-start-date">
            Start date
          </label>
          <input
            id="chapter-start-date"
            class="input input-bordered mt-2"
            onInput={(e) => {
              const chapterId = currentChapter()?.id
              if (chapterId) {
                updateChapter(chapterId, {
                  start_date: e.target.value,
                })
              }
            }}
            placeholder="start date"
            value={currentChapter()?.start_date ?? ''}
          />
          <p class="text-sm text-gray-500">This is the date the chapter starts in story time.</p>
        </div>
        <Show when={currentChapter()?.id}>{(id) => <NodeTypeButtons nodeId={id()} />}</Show>
        {currentChapter()?.extra ? (
          <FormField label="Extra">
            <textarea
              class="textarea textarea-bordered"
              onChange={(e) => {
                const chapterId = currentChapter()?.id
                if (chapterId) {
                  updateChapter(chapterId, {
                    extra: e.target.value,
                  })
                }
              }}
              rows={18}
              placeholder="extra"
              style={{ width: '100%' }}
              value={currentChapter()?.extra ?? ''}
            />
          </FormField>
        ) : null}
        <button
          type="button"
          class="btn btn-blue"
          disabled={isAiLoading()}
          onClick={() => {
            help('suggest_title')
          }}
        >
          <Show when={isAiLoading()}>
            <span class="loading loading-spinner loading-xs mr-2" />
          </Show>
          [AI] Suggest title
        </button>
        <button
          type="button"
          class="btn btn-blue"
          disabled={isAiLoading()}
          onClick={() => {
            help('summarize')
          }}
        >
          <Show when={isAiLoading()}>
            <span class="loading loading-spinner loading-xs mr-2" />
          </Show>
          [AI] Summarize Chapter
        </button>
        <button
          type="button"
          class="btn btn-blue"
          disabled={isAiLoading()}
          onClick={() => {
            help('rewrite_spelling')
          }}
        >
          <Show when={isAiLoading()}>
            <span class="loading loading-spinner loading-xs mr-2" />
          </Show>
          [AI] Spelling
        </button>
        <button
          type="button"
          class="btn btn-error"
          onClick={() => {
            const chapterId = currentChapter()?.id
            if (chapterId) {
              deleteChapter(chapterId)
            }
          }}
        >
          Delete
        </button>
      </div>
    </div>
  ) : null
}
