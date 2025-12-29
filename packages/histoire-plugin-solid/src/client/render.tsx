// @ts-expect-error virtual module id
import * as generatedSetup from 'virtual:$histoire-generated-global-setup'
// @ts-expect-error virtual module id
import * as setup from 'virtual:$histoire-setup'
import type { Story, Variant } from '@histoire/shared'
import type { PropType as _PropType } from '@histoire/vendors/vue'
import {
  defineComponent as _defineComponent,
  h as _h,
  onMounted as _onMounted,
  onUnmounted as _onUnmounted,
  ref as _ref,
  watch as _watch,
} from '@histoire/vendors/vue'
import { render } from 'solid-js/web'
import type { SolidStorySetupHandler } from '../helpers.js'
import { HstContext, RenderStory as RenderStorySolid, RenderVariant as RenderVariantSolid } from './components'
import { syncState } from './util'

export default _defineComponent({
  name: 'RenderStory',

  props: {
    variant: {
      type: Object as _PropType<Variant>,
      required: true,
    },

    story: {
      type: Object as _PropType<Story>,
      required: true,
    },

    slotName: {
      type: String,
      default: 'default',
    },
  },

  emits: {
    ready: () => true,
  },

  setup(props, { emit }) {
    const el = _ref<HTMLDivElement>()
    let dispose: (() => void) | null = null
    let target: HTMLDivElement | null = null
    let stopSync: (() => void) | null = null

    async function mountStory() {
      target = document.createElement('div')
      el.value?.appendChild(target)

      // Set up state synchronization
      const { stop } = syncState(props.variant.state, (_value) => {
        // State updates will trigger Solid reactivity
      })
      stopSync = stop

      const Comp = props.story.file?.component

      if (!Comp) {
        console.error('[histoire-plugin-solid] No component found!')
        emit('ready')
        return
      }

      dispose = render(() => {
        return (
          <HstContext.Provider value={{ story: props.story, variant: props.variant, slotName: props.slotName }}>
            <Comp
              Hst={{
                Story: RenderStorySolid,
                Variant: RenderVariantSolid,
              }}
            />
          </HstContext.Provider>
        )
      }, target)

      // Call setup functions
      if (typeof generatedSetup?.setupSolid === 'function') {
        const setupFn = generatedSetup.setupSolid as SolidStorySetupHandler
        await setupFn({ story: props.story, variant: props.variant })
      }

      if (typeof setup?.setupSolid === 'function') {
        const setupFn = setup.setupSolid as SolidStorySetupHandler
        await setupFn({ story: props.story, variant: props.variant })
      }

      if (typeof props.variant.setupApp === 'function') {
        const setupFn = props.variant.setupApp as SolidStorySetupHandler
        await setupFn({ story: props.story, variant: props.variant })
      }

      emit('ready')
    }

    function unmountStory() {
      stopSync?.()
      stopSync = null
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
      ref: 'el' as any,
    })
  },
})
