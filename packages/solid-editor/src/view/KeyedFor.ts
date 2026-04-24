import { type Accessor, type JSX, createSignal, onCleanup, createRoot } from 'solid-js'

/**
 * A keyed list renderer for SolidJS.
 *
 * Like `<For>` but reconciles by a key function instead of reference identity,
 * and like `<Index>` gives the callback a signal for the current value (since
 * the value at a given key can change over time).
 *
 * This is exactly what we need for rendering ProseMirror document children:
 * - Nodes are keyed by their `id` — insertions/removals create/destroy DOM correctly
 * - When a node's content changes (same id, new object), the signal updates
 *   and the existing DOM subtree reacts to the new props
 */
export function KeyedFor<T, K, U extends JSX.Element>(props: {
  each: readonly T[] | undefined | null | false
  by: (item: T) => K
  children: (item: Accessor<T>, index: Accessor<number>) => U
}): JSX.Element {
  // Track rows by key: each row owns a signal for its value, a signal for
  // its index, and a dispose function for cleanup.
  const rows = new Map<
    K,
    {
      value: Accessor<T>
      setValue: (v: T) => void
      index: Accessor<number>
      setIndex: (i: number) => void
      element: U
      dispose: () => void
    }
  >()

  // Ordered list of keys matching the current array order
  let orderedKeys: K[] = []

  // We need a reactive root to return a memo of the rendered elements.
  // Use createMemo-like pattern: return a function that computes the result.
  return (() => {
    const list = props.each
    if (!list || list.length === 0) {
      // Clean up all existing rows
      for (const row of rows.values()) {
        row.dispose()
      }
      rows.clear()
      orderedKeys = []
      return []
    }

    const newKeys: K[] = []
    const seenKeys = new Set<K>()

    for (let i = 0; i < list.length; i++) {
      const item = list[i]
      const key = props.by(item)
      newKeys.push(key)
      seenKeys.add(key)

      const existing = rows.get(key)
      if (existing) {
        // Update value and index for existing row
        existing.setValue(item)
        existing.setIndex(i)
      } else {
        // Create new row
        let element!: U
        let dispose!: () => void
        const [value, setValue] = createSignal<T>(item)
        const [index, setIndex] = createSignal<number>(i)

        createRoot((d) => {
          dispose = d
          element = props.children(value as Accessor<T>, index)
        })

        rows.set(key, { value: value as Accessor<T>, setValue, index, setIndex, element, dispose })
      }
    }

    // Remove rows whose keys are no longer present
    for (const [key, row] of rows) {
      if (!seenKeys.has(key)) {
        row.dispose()
        rows.delete(key)
      }
    }

    orderedKeys = newKeys

    // Return elements in the current order
    return newKeys.map((key) => rows.get(key)!.element)
  }) as unknown as JSX.Element
}
