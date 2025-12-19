import { Show } from 'solid-js'
import { deleteBook, updateBookValue } from '../lib/stores/books'
import { currentBook } from '../lib/stores/retrieval/current-book'
import { findNode, updateNode } from '../lib/stores/tree'
import { FileSelector } from './FileSelector'
import { NodeTypeButtons } from './NodeTypeButtons'
import { FormField } from './styled/FormField'

export const BookTabs = () => {
  return (
    <Show when={currentBook()}>
      <div class="flex flex-col overflow-hidden">
        <div class="tabs tabs-bordered">
          <button class="tab" type="button">
            Overview
          </button>
        </div>
        <div class="overflow-auto p-4">
          <FormField label="Title">
            <input
              type="text"
              placeholder="title"
              class="input input-bordered"
              onInput={(e) => {
                updateBookValue(currentBook()!.id, 'title', e.currentTarget.value)
              }}
              value={currentBook()?.title}
            />
          </FormField>
          <FormField label="Modified Time">
            <input
              type="text"
              placeholder="modified time"
              class="input input-bordered"
              disabled
              value={currentBook()?.modifiedAt}
            />
          </FormField>
          <FormField label="Author">
            <input
              type="text"
              placeholder="author"
              class="input input-bordered"
              onInput={(e) => {
                updateBookValue(currentBook()!.id, 'author', e.currentTarget.value)
              }}
              value={currentBook()?.author ?? ''}
            />
          </FormField>
          <FormField label="Editor">
            <input
              type="text"
              placeholder="editor"
              class="input input-bordered"
              onInput={(e) => {
                updateBookValue(currentBook()!.id, 'editor', e.currentTarget.value)
              }}
              value={currentBook()?.editor ?? ''}
            />
          </FormField>
          <FormField label="Cover artist">
            <input
              type="text"
              placeholder="cover artist"
              class="input input-bordered"
              onInput={(e) => {
                updateBookValue(currentBook()!.id, 'coverArtist', e.currentTarget.value)
              }}
              value={currentBook()?.coverArtist ?? ''}
            />
          </FormField>
          <FormField label="Summary">
            <textarea
              class="textarea textarea-bordered mt-2"
              placeholder="summary"
              style={{ height: '300px' }}
              onInput={(e) => {
                updateBookValue(currentBook()!.id, 'summary', e.currentTarget.value)
                updateNode(currentBook()!.id, {
                  oneliner: e.currentTarget.value,
                })
              }}
              value={currentBook()?.summary}
            />
          </FormField>
          <FormField label="Cover image">
            <FileSelector
              value={currentBook()?.coverImage ?? ''}
              onChange={(file) => {
                updateBookValue(currentBook()!.id, 'coverImage', file)
              }}
            />
          </FormField>
          <FormField label="Separator image">
            <FileSelector
              value={currentBook()?.separatorImage ?? ''}
              onChange={(file) => {
                updateBookValue(currentBook()!.id, 'separatorImage', file)
              }}
            />
          </FormField>
          <FormField label="Start date">
            <input
              type="text"
              class="input input-bordered mt-2"
              placeholder="start date"
              onInput={(e) => {
                updateBookValue(currentBook()!.id, 'start_date', e.currentTarget.value)
              }}
              value={currentBook()?.start_date ?? ''}
            />
          </FormField>
          <Show when={currentBook()?.id}>{(id) => <NodeTypeButtons nodeId={id()} />}</Show>
          <FormField label="AI Response">
            <textarea
              class="textarea textarea-bordered mt-2"
              placeholder="critique"
              style={{ height: '300px' }}
              onInput={(e) => {
                updateBookValue(currentBook()!.id, 'critique', e.currentTarget.value)
              }}
              value={currentBook()?.critique ?? ''}
            />
          </FormField>
          <button
            type="button"
            class="btn btn-error"
            disabled={(findNode(currentBook()!.id)?.children?.length ?? 0) > 0}
            onClick={() => {
              deleteBook(currentBook()!.id)
            }}
          >
            Delete
          </button>
        </div>
      </div>
    </Show>
  )
}
