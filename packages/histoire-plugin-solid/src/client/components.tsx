import type { Story, Variant } from '@histoire/shared'
import { type ParentComponent, Show, createContext, createSignal, onMount, useContext } from 'solid-js'

// Context for passing story/variant data from the Vue wrapper
interface HstContextValue {
  story: Story
  variant?: Variant
  slotName?: string
}

export const HstContext = createContext<HstContextValue>()

// Context for MountStory to pass story to MountVariant
interface MountContextValue {
  story: Story
  variantIndex: () => number
  incrementVariantIndex: () => void
}

export const MountContext = createContext<MountContextValue>()

// Mount variants - for the story overview (runs in main app, hidden)
export const MountStory: ParentComponent<{
  title?: string
}> = (props) => {
  // MountStory doesn't have direct access to the story here
  // It's provided via HstContext from the Vue wrapper
  return <>{props.children}</>
}

// This version is used when we have the story from context
export const MountStoryWithContext: ParentComponent<{
  story: Story
}> = (props) => {
  const [variantIndex, setVariantIndex] = createSignal(0)

  const ctx: MountContextValue = {
    story: props.story,
    variantIndex,
    incrementVariantIndex: () => setVariantIndex((i) => i + 1),
  }

  return <MountContext.Provider value={ctx}>{props.children}</MountContext.Provider>
}

export const MountVariant: ParentComponent<{
  title?: string
  id?: string
}> = (props) => {
  const ctx = useContext(MountContext)

  // Set configReady on the variant if we have context
  onMount(() => {
    if (ctx) {
      const index = ctx.variantIndex()
      const variant = ctx.story.variants[index]
      ctx.incrementVariantIndex()

      if (variant) {
        Object.assign(variant, {
          slots: () => ({ default: true }),
          configReady: true,
        })
      }
    }
  })

  return (
    <div style={{ padding: '8px', border: '1px dashed #ccc', 'border-radius': '4px', margin: '4px 0' }}>
      <span style={{ color: '#666', 'font-size': '12px' }}>{props.title || 'Variant'}</span>
    </div>
  )
}

// Render variants - for actual variant preview
export const RenderStory: ParentComponent<{
  title?: string
}> = (props) => {
  const ctx = useContext(HstContext)

  // Set configReady on the story (like Vue/Svelte do)
  onMount(() => {
    if (ctx?.story) {
      Object.assign(ctx.story, {
        slots: () => ({ default: true }),
      })
    }
  })

  // Just pass through children - context is provided from Vue wrapper
  return <>{props.children}</>
}

export const RenderVariant: ParentComponent<{
  title?: string
  id?: string
}> = (props) => {
  const ctx = useContext(HstContext)

  // Only render if this variant matches the current one
  const isCurrentVariant = () => {
    if (!ctx?.variant) return true
    // Match by id or title
    return ctx.variant.id === props.id || ctx.variant.title === props.title
  }

  // Set configReady on the variant (like Vue/Svelte do)
  // This tells Histoire that the variant is ready for the controls panel
  onMount(() => {
    if (ctx?.variant && isCurrentVariant()) {
      Object.assign(ctx.variant, {
        slots: () => ({ default: true }),
        configReady: true,
      })
    }
  })

  return <Show when={isCurrentVariant()}>{props.children}</Show>
}
