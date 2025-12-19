import { Book } from '@writer/shared'
import shortUUID from 'short-uuid'
import { createStore } from 'solid-js/store'
import { setStoryState } from './story'
import { appendNode, findNode, removeNode, updateNode } from './tree'

const booksStoreDefault = {
  books: {},
}
export const [booksStore, setBooksStore] = createStore<{
  books: Record<string, Book>
}>(booksStoreDefault)

export const resetBooksStore = () => {
  setBooksStore('books', {})
}

export const createBook = () => {
  const id = shortUUID.generate()
  setBooksStore('books', id, {
    id,
    title: 'New book',
    summary: '',
    modifiedAt: Date.now(),
  } satisfies Book)
  appendNode({
    id,
    type: 'book',
    name: 'New book',
    isOpen: true,
    nodeType: 'story',
  })
  setStoryState('story', 'modifiedTime', Date.now())
  return id
}

export const updateBookValue = <K extends keyof Book>(id: string, key: K, value: Book[K]) => {
  const currentValue = booksStore.books[id]
  setBooksStore('books', id, {
    summary: '',
    id: id,
    ...currentValue,
    [key]: value,
    modifiedAt: Date.now(),
  })
  setStoryState('story', 'modifiedTime', Date.now())
  if (key === 'title') {
    updateNode(id, { name: value as string })
  }
}

export const deleteBook = (id: string) => {
  // check if there are any arcs in this book
  const arcs = findNode(id)?.children?.filter((c) => c.type === 'arc')
  if (arcs && arcs.length > 0) {
    alert('Remove all arcs first')
    return
  }
  removeNode(id)
  setStoryState('story', 'modifiedTime', Date.now())
  // @ts-expect-error: this is a valid way to delete
  setBooksStore('books', id, undefined)
}
