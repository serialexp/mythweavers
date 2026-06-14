import { type Component, Show, onMount } from 'solid-js'
import { useNavigate, useParams } from '@solidjs/router'
import { Button, Spinner, Text } from '@mythweavers/ui'
import {
  useAdventurePersistence,
  type AdventurePersistence,
} from '../hooks/useAdventurePersistence'
import { adventureStore } from '../stores/adventureStore'
import {
  AdventureEngineContext,
  createAdventureEngine,
} from './adventure/useAdventureEngine'
import { AdventureHeader } from './adventure/AdventureHeader'
import { PlayingScreen } from './adventure/PlayingScreen'
import * as styles from './AdventurePage.css'

/**
 * Wrapper component that handles loading state from the backend.
 * Once loaded, renders the inner component with the initial state.
 */
export const AdventurePage: Component = () => {
  const params = useParams()
  const persistence = useAdventurePersistence(params.id)

  return (
    <Show
      when={!persistence.isLoading()}
      fallback={
        <div class={styles.container}>
          <div
            style={{
              display: 'flex',
              'justify-content': 'center',
              'align-items': 'center',
              flex: 1,
            }}
          >
            <Spinner size="lg" />
          </div>
        </div>
      }
    >
      <Show
        when={!persistence.loadError()}
        fallback={
          <div class={styles.container}>
            <div
              style={{
                display: 'flex',
                'flex-direction': 'column',
                'justify-content': 'center',
                'align-items': 'center',
                flex: 1,
                gap: '1rem',
              }}
            >
              <Text size="lg" color="secondary">
                {persistence.loadError()}
              </Text>
              <Button
                variant="secondary"
                onClick={() => window.history.back()}
              >
                Go Back
              </Button>
            </div>
          </div>
        }
      >
        <AdventurePageInner persistence={persistence} />
      </Show>
    </Show>
  )
}

const AdventurePageInner: Component<{ persistence: AdventurePersistence }> = (
  props,
) => {
  const navigate = useNavigate()

  // Initialize the store from persisted state
  adventureStore.initialize(props.persistence.initialState())

  // If still in setup phase (e.g. navigated directly to /adventure/new),
  // redirect to the stories list where the "New Adventure" popup lives.
  onMount(() => {
    if (adventureStore.phase === 'setup') {
      navigate('/stories', { replace: true })
    }
  })

  // Create the engine (sets up effects, scroll management, etc.)
  const engine = createAdventureEngine(props.persistence, navigate)

  return (
    <AdventureEngineContext.Provider value={engine}>
      <div class={styles.container}>
        <AdventureHeader onBack={() => navigate('/stories')} />

        <Show
          when={adventureStore.phase === 'playing'}
          fallback={
            <div
              style={{
                display: 'flex',
                'flex-direction': 'column',
                'justify-content': 'center',
                'align-items': 'center',
                flex: 1,
                gap: '1rem',
              }}
            >
              <Spinner size="lg" />
            </div>
          }
        >
          <PlayingScreen />
        </Show>
      </div>
    </AdventureEngineContext.Provider>
  )
}
