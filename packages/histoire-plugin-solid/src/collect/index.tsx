// @ts-expect-error virtual module id
import * as generatedSetup from 'virtual:$histoire-generated-global-setup'
// @ts-expect-error virtual module id
import * as setup from 'virtual:$histoire-setup'
import type { ServerRunPayload, ServerStory, ServerVariant } from '@histoire/shared'
import { createComponent, createRoot } from 'solid-js'
import { type ParentComponent, createContext, useContext } from 'solid-js'
import type { SolidStorySetupHandler } from '../helpers.js'

// Context for story collection
interface StoryContext {
  addStory: (story: ServerStory) => void
  fileData: any
}

interface VariantContext {
  story: ServerStory
  addVariant: (variant: ServerVariant) => void
}

const StoryContext = createContext<StoryContext>()
const VariantContext = createContext<VariantContext>()

// Story component for collection - extracts metadata only
export const Story: ParentComponent<{
  title?: string
  id?: string
  group?: string
  layout?: ServerStory['layout']
  icon?: string
  iconColor?: string
  docsOnly?: boolean
}> = (props) => {
  const ctx = useContext(StoryContext)
  if (!ctx) return null

  const story: ServerStory = {
    id: props.id ?? ctx.fileData.id,
    title: props.title ?? ctx.fileData.fileName,
    group: props.group,
    layout: props.layout,
    icon: props.icon,
    iconColor: props.iconColor,
    docsOnly: props.docsOnly,
    variants: [],
  }

  ctx.addStory(story)

  // Create variant context for Variant children to register themselves
  const variantCtx: VariantContext = {
    story,
    addVariant: (variant) => {
      story.variants.push(variant)
    },
  }

  // Provide context but DON'T render children content - only Variant registration
  return <VariantContext.Provider value={variantCtx}>{props.children}</VariantContext.Provider>
}

// Variant component for collection - registers variant metadata, doesn't render content
export const Variant: ParentComponent<{
  title?: string
  id?: string
  icon?: string
  iconColor?: string
  source?: string
}> = (props) => {
  const ctx = useContext(VariantContext)
  if (!ctx) return null

  const variant: ServerVariant = {
    id: props.id ?? `${ctx.story.id}-${ctx.story.variants.length}`,
    title: props.title ?? 'untitled',
    icon: props.icon,
    iconColor: props.iconColor,
    source: props.source,
  } as ServerVariant

  ctx.addVariant(variant)

  // Don't render children during collection - return empty
  return null
}

export async function run({ file, storyData }: ServerRunPayload) {
  const module = await import(/* @vite-ignore */ file.moduleId)
  const Comp = module.default
  if (!Comp) {
    return
  }

  const storyCtx: StoryContext = {
    addStory: (story) => {
      storyData.push(story)
    },
    fileData: file,
  }

  // Execute component tree to collect story metadata
  // We use createRoot to establish a reactive context, then createComponent to build the tree
  let dispose: () => void
  createRoot((d) => {
    dispose = d
    createComponent(StoryContext.Provider, {
      value: storyCtx,
      get children() {
        return createComponent(Comp, {
          Hst: { Story, Variant },
        })
      },
    })
  })
  // Dispose after execution
  dispose!()

  // Call setup functions
  if (typeof generatedSetup?.setupSolid === 'function') {
    const setupFn = generatedSetup.setupSolid as SolidStorySetupHandler
    await setupFn({ story: null, variant: null })
  }

  if (typeof setup?.setupSolid === 'function') {
    const setupFn = setup.setupSolid as SolidStorySetupHandler
    await setupFn({ story: null, variant: null })
  }

  // Add default variant if none were found
  if (storyData.length > 0 && storyData[0]?.variants.length === 0) {
    storyData[0].variants.push({
      id: '_default',
      title: 'default',
    })
  }
}
