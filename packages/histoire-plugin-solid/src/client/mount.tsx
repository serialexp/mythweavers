// @ts-expect-error virtual module id
import * as generatedSetup from 'virtual:$histoire-generated-global-setup'
// @ts-expect-error virtual module id
import * as setup from 'virtual:$histoire-setup'
import type { Story } from '@histoire/shared'
import type { PropType as _PropType } from '@histoire/vendors/vue'
import {
  defineComponent as _defineComponent,
  h as _h,
  onMounted as _onMounted,
  onUnmounted as _onUnmounted,
  ref as _ref,
  watch as _watch,
} from '@histoire/vendors/vue'
import prettierBabel from 'prettier/plugins/babel'
import prettierEstree from 'prettier/plugins/estree'
import { format } from 'prettier/standalone'
import { render } from 'solid-js/web'
import type { SolidStorySetupHandler } from '../helpers.js'
import { MountStory as MountStorySolid, MountStoryWithContext, MountVariant as MountVariantSolid } from './components'

async function formatCode(code: string): Promise<string> {
  try {
    let result = await format(code, {
      parser: 'babel',
      plugins: [prettierBabel, prettierEstree],
      printWidth: 50,
      tabWidth: 2,
      useTabs: false,
      semi: false,
      singleQuote: true,
      jsxSingleQuote: false,
      singleAttributePerLine: true,
    })
    // Prettier adds a leading semicolon for expression statements, strip it
    result = result.trim()
    if (result.startsWith(';')) {
      result = result.slice(1).trim()
    }
    return result
  } catch (e) {
    console.warn('[histoire-plugin-solid] Prettier formatting failed:', e)
    return code.trim()
  }
}

// Extract variant source code from the story file source
async function extractVariantSources(story: Story) {
  const sourceLoader = story.file?.source
  if (!sourceLoader) return

  try {
    const sourceModule = await sourceLoader()
    const source = sourceModule.default as string

    // For each variant, find its content in the source
    for (const variant of story.variants) {
      const variantSource = await extractVariantContent(source, variant.title)
      if (variantSource) {
        variant.source = variantSource
      }
    }
  } catch (e) {
    console.warn('[histoire-plugin-solid] Failed to extract variant sources:', e)
  }
}

async function extractVariantContent(source: string, variantTitle: string): Promise<string | null> {
  // Match <Hst.Variant title="Title"> or <Hst.Variant title='Title'>
  // Need to handle multiline and various formatting
  const escapedTitle = variantTitle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const openTagPattern = new RegExp(`<Hst\\.Variant[^>]*title=["']${escapedTitle}["'][^>]*>`, 's')

  const match = source.match(openTagPattern)
  if (!match) return null

  const startIndex = match.index! + match[0].length

  // Find the matching closing tag, accounting for nested Variants
  let depth = 1
  let endIndex = startIndex
  const remaining = source.slice(startIndex)

  // Simple approach: find </Hst.Variant> while tracking nesting
  const tagPattern = /<Hst\.Variant[^>]*>|<\/Hst\.Variant>/g
  let tagMatch: RegExpExecArray | null

  while ((tagMatch = tagPattern.exec(remaining)) !== null) {
    if (tagMatch[0].startsWith('</')) {
      depth--
      if (depth === 0) {
        endIndex = startIndex + tagMatch.index
        break
      }
    } else {
      depth++
    }
  }

  if (depth !== 0) return null

  const content = source.slice(startIndex, endIndex).trim()
  return formatCode(content)
}

export default _defineComponent({
  name: 'MountStory',

  props: {
    story: {
      type: Object as _PropType<Story>,
      required: true,
    },
  },

  setup(props) {
    console.log('[histoire-plugin-solid] MountStory setup() called!', props)

    const el = _ref<HTMLDivElement>()
    let dispose: (() => void) | null = null
    let target: HTMLDivElement | null = null

    async function mountStory() {
      console.log('[histoire-plugin-solid] MountStory mountStory() called')
      target = document.createElement('div')
      el.value?.appendChild(target)

      // Extract variant source code from the story file
      await extractVariantSources(props.story)

      dispose = render(() => {
        const Comp = props.story.file?.component
        if (!Comp) return null

        return (
          <MountStoryWithContext story={props.story}>
            <Comp
              Hst={{
                Story: MountStorySolid,
                Variant: MountVariantSolid,
              }}
            />
          </MountStoryWithContext>
        )
      }, target)

      // Call setup functions
      if (typeof generatedSetup?.setupSolid === 'function') {
        const setupFn = generatedSetup.setupSolid as SolidStorySetupHandler
        await setupFn({ story: props.story, variant: null })
      }

      if (typeof setup?.setupSolid === 'function') {
        const setupFn = setup.setupSolid as SolidStorySetupHandler
        await setupFn({ story: props.story, variant: null })
      }
    }

    function unmountStory() {
      dispose?.()
      dispose = null
      if (target) {
        target.parentNode?.removeChild(target)
        target = null
      }
    }

    _watch(
      () => props.story.id,
      async () => {
        unmountStory()
        await mountStory()
      },
    )

    _onMounted(async () => {
      await mountStory()
    })

    _onUnmounted(() => {
      unmountStory()
    })

    return {
      el,
    }
  },

  render() {
    return _h('div', {
      ref: 'el',
    })
  },
})
