import type { Item } from '@writer/shared'
import { createStore } from 'solid-js/store'

const itemsDefault = { items: {} }
export const [items, setItemsState] = createStore<{
  items: Record<string, Item>
}>(itemsDefault)

export const resetItems = () => {
  setItemsState({
    items: {},
  })
}

export const setItems = (items: Record<string, Item>) => {
  setItemsState('items', items)
}
