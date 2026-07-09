import { Button, Fieldset, Modal } from '@mythweavers/ui'
import { useNavigate } from '@solidjs/router'
import { type Stripe, type StripeElements, loadStripe } from '@stripe/stripe-js'
import { Component, For, Show, createEffect, createResource, createSignal, on, onCleanup } from 'solid-js'
import { getMyBalance, getMyLlmModels, postMyBalanceTopup } from '../client/config'
import { authStore } from '../stores/authStore'
import { modelsStore } from '../stores/modelsStore'
import { settingsStore } from '../stores/settingsStore'
import { ModelSelector } from './ModelSelector'
import { PasswordForEncryptionDialog } from './PasswordForEncryptionDialog'
import * as styles from './ProviderModelSelector.css'

/**
 * Provider selection component.
 * Reads from and writes to settingsStore directly — no prop drilling.
 *
 * Optionally auto-fetches models on mount and when the provider changes.
 */
interface ProviderSelectorProps {
  /**
   * If true, automatically fetches models on mount and when the provider changes.
   * Set to false if the parent already handles model fetching (e.g. the main app).
   * Defaults to false.
   */
  autoFetchModels?: boolean
  /** Override: current provider value. Defaults to settingsStore.provider. */
  provider?: string
  /** Override: setter for provider. Defaults to settingsStore.setProvider. */
  setProvider?: (provider: string) => void
}

/** Check whether a given provider value has credentials configured. */
const isProviderAvailable = (value: string): boolean => {
  // These don't need API keys
  if (value === 'ollama' || value === 'server') return true

  if (value === 'cloudflare') {
    return !!settingsStore.cloudflareApiKey && !!settingsStore.cloudflareEndpoint
  }

  if (value.startsWith('custom:')) {
    const id = value.slice('custom:'.length)
    const custom = settingsStore.getCustomProvider(id)
    return !!custom?.apiKey
  }

  switch (value) {
    case 'openrouter':
      return !!settingsStore.openrouterApiKey
    case 'anthropic':
      return !!settingsStore.anthropicApiKey
    case 'openai':
      return !!settingsStore.openaiApiKey
    default:
      return true
  }
}

export const ProviderSelector: Component<ProviderSelectorProps> = (props) => {
  const currentProvider = () => props.provider ?? settingsStore.provider
  const setCurrentProvider = (v: string) => (props.setProvider ?? settingsStore.setProvider)(v)

  // Auto-fetch models when provider changes (if enabled)
  if (props.autoFetchModels) {
    createEffect(
      on(currentProvider, () => {
        modelsStore.fetchModels()
      }),
    )
  }

  return (
    <div class={styles.section}>
      <div class={styles.settingRow}>
        <label class={styles.label}>Provider</label>
        <select value={currentProvider()} onChange={(e) => setCurrentProvider(e.target.value)} class={styles.select}>
          <option value="ollama" disabled={!isProviderAvailable('ollama')}>
            Ollama
          </option>
          <option value="openrouter" disabled={!isProviderAvailable('openrouter')}>
            OpenRouter
          </option>
          <option value="anthropic" disabled={!isProviderAvailable('anthropic')}>
            Anthropic
          </option>
          <option value="openai" disabled={!isProviderAvailable('openai')}>
            OpenAI
          </option>
          <option value="cloudflare" disabled={!isProviderAvailable('cloudflare')}>
            Cloudflare Workers AI
          </option>
          <option value="server" disabled={!isProviderAvailable('server')}>
            Mythweavers
          </option>
          <For each={settingsStore.customProviders}>
            {(p) => (
              <option value={`custom:${p.id}`} disabled={!isProviderAvailable(`custom:${p.id}`)}>
                {p.name}
              </option>
            )}
          </For>
        </select>
      </div>
    </div>
  )
}

const TOPUP_PRESETS = [5, 10, 25, 50]

/** Input field with a show/hide toggle for API keys. */
const SecretInput: Component<{
  value: string
  onChange: (value: string) => void
  placeholder?: string
}> = (props) => {
  const [visible, setVisible] = createSignal(false)

  return (
    <div class={styles.secretInputWrapper}>
      <input
        type={visible() ? 'text' : 'password'}
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        class={styles.secretInput}
        placeholder={props.placeholder}
      />
      <button type="button" class={styles.secretToggle} onClick={() => setVisible(!visible())}>
        {visible() ? 'Hide' : 'Show'}
      </button>
    </div>
  )
}

/**
 * API key management component.
 * Shows all provider key fields at once, with Mythweavers balance at the top.
 */
export const ApiKeys: Component = () => {
  const navigate = useNavigate()
  const [showEncryptPrompt, setShowEncryptPrompt] = createSignal(false)

  const fetchBalance = async () => {
    try {
      const { data } = await getMyBalance()
      if (!data) return null
      return Number(data.balance)
    } catch {
      return null
    }
  }

  const [balance, { refetch: refetchBalance }] = createResource(fetchBalance)

  const fetchServerModels = async () => {
    try {
      const { data } = await getMyLlmModels()
      return data?.models ?? []
    } catch {
      return []
    }
  }
  const [serverModels] = createResource(fetchServerModels)

  // ~1.3 tokens per word for English prose, but output pricing dominates story generation costs.
  // We estimate based on output tokens since that's what you're paying for (the story text).
  const TOKENS_PER_WORD = 1.3
  // Typical input:output ratio for story generation — roughly 3:1 input to 1 output
  // (context window with story so far + instructions → new story text)
  const INPUT_OUTPUT_RATIO = 3

  const modelEstimates = () => {
    const amount = effectiveAmount()
    const models = serverModels()
    if (!amount || !models?.length) return []

    return models.map((m) => {
      const costPerOutputToken = m.pricing.output / 1_000_000
      const costPerInputToken = m.pricing.input / 1_000_000
      // Cost per output token including the input that generated it
      const effectiveCostPerOutputToken = costPerOutputToken + costPerInputToken * INPUT_OUTPUT_RATIO
      const outputTokens = amount / effectiveCostPerOutputToken
      const words = Math.floor(outputTokens / TOKENS_PER_WORD)
      return {
        name: m.displayName || m.name,
        words,
      }
    })
  }

  const [showTopUp, setShowTopUp] = createSignal(false)
  const [topUpAmount, setTopUpAmount] = createSignal<number | null>(null)
  const [customAmount, setCustomAmount] = createSignal('')
  const [showPaymentModal, setShowPaymentModal] = createSignal(false)
  const [paymentStatus, setPaymentStatus] = createSignal<'ready' | 'processing' | 'success'>('ready')
  const [isProcessing, setIsProcessing] = createSignal(false)
  const [paymentError, setPaymentError] = createSignal('')

  let stripeInstance: Stripe | null = null
  let stripeElements: StripeElements | null = null
  let paymentElementContainer: HTMLDivElement | undefined

  const effectiveAmount = () => topUpAmount() ?? (Number(customAmount()) || null)

  const selectPreset = (amount: number) => {
    setTopUpAmount(amount)
    setCustomAmount('')
  }

  const handleCustomInput = (value: string) => {
    setCustomAmount(value)
    setTopUpAmount(null)
  }

  const handleContinueToPayment = async () => {
    const amount = effectiveAmount()
    if (!amount || amount <= 0) return

    setIsProcessing(true)
    setPaymentError('')

    try {
      const { data, error } = await postMyBalanceTopup({ body: { amount } })
      if (error || !data?.clientSecret) {
        setPaymentError((error as any)?.error || 'Failed to create payment')
        return
      }

      const publishableKey =
        ((window as any).RUNTIME_CONFIG?.STRIPE_PUBLISHABLE_KEY as string | undefined) ||
        import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY
      if (!publishableKey) {
        setPaymentError('Stripe publishable key not configured')
        return
      }

      if (!stripeInstance) {
        stripeInstance = await loadStripe(publishableKey)
      }
      if (!stripeInstance) {
        setPaymentError('Failed to load Stripe')
        return
      }

      stripeElements = stripeInstance.elements({
        clientSecret: data.clientSecret,
        appearance: {
          theme: 'night',
          variables: {
            colorPrimary: '#c9a227',
            colorBackground: '#252220',
            colorText: '#e8dcc8',
            colorTextSecondary: '#b8a88e',
            colorTextPlaceholder: '#7a6c58',
            colorDanger: '#a63d40',
            fontFamily: 'system-ui, -apple-system, sans-serif',
            borderRadius: '0px',
          },
          rules: {
            '.Input': {
              backgroundColor: '#1c1816',
              border: '1px solid #3d3428',
              color: '#e8dcc8',
              boxShadow: 'none',
            },
            '.Input:focus': {
              border: '1px solid #c9a227',
              boxShadow: 'none',
            },
            '.Label': {
              color: '#b8a88e',
            },
            '.Tab': {
              border: '1px solid #3d3428',
              backgroundColor: '#1c1816',
              color: '#b8a88e',
            },
            '.Tab:hover': {
              backgroundColor: '#332e2a',
              color: '#e8dcc8',
            },
            '.Tab--selected': {
              backgroundColor: '#332e2a',
              borderColor: '#c9a227',
              color: '#e8dcc8',
            },
            '.AccordionItem': {
              boxShadow: 'none',
            },
          },
        },
      })

      setShowPaymentModal(true)
      setPaymentStatus('ready')

      // Mount once the container is in the DOM
      requestAnimationFrame(() => {
        if (paymentElementContainer && stripeElements) {
          const paymentElement = stripeElements.create('payment')
          paymentElement.mount(paymentElementContainer)
        }
      })
    } catch {
      setPaymentError('Failed to connect to server')
    } finally {
      setIsProcessing(false)
    }
  }

  const handleConfirmPayment = async () => {
    if (!stripeInstance || !stripeElements) return

    setPaymentStatus('processing')
    setPaymentError('')

    const balanceBefore = balance() ?? 0

    try {
      const { error } = await stripeInstance.confirmPayment({
        elements: stripeElements,
        confirmParams: {
          return_url: window.location.href,
        },
        redirect: 'if_required',
      })

      if (error) {
        setPaymentError(error.message || 'Payment failed')
        setPaymentStatus('ready')
      } else {
        // Payment confirmed — now wait for the webhook to credit the balance.
        // Poll until the balance actually changes, then show success.
        const MAX_ATTEMPTS = 30
        const POLL_INTERVAL_MS = 1000
        let credited = false

        for (let i = 0; i < MAX_ATTEMPTS; i++) {
          await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS))
          try {
            const { data } = await getMyBalance()
            if (data && Number(data.balance) > balanceBefore) {
              credited = true
              break
            }
          } catch {
            // ignore transient fetch errors, keep polling
          }
        }

        await refetchBalance()
        if (credited) {
          setPaymentStatus('success')
        } else {
          // Balance didn't change within the timeout — payment went through
          // on Stripe's side but the webhook may be delayed.
          setPaymentStatus('success')
          setPaymentError('Balance update is taking longer than expected. Try refreshing in a moment.')
        }
      }
    } catch {
      setPaymentError('Payment failed unexpectedly')
      setPaymentStatus('ready')
    }
  }

  const resetTopUp = () => {
    setShowTopUp(false)
    setShowPaymentModal(false)
    setPaymentStatus('ready')
    setTopUpAmount(null)
    setCustomAmount('')
    setPaymentError('')
    stripeElements = null
  }

  const closePaymentModal = () => {
    if (paymentStatus() === 'processing') return // Don't close while processing
    if (paymentStatus() === 'success') {
      resetTopUp()
    } else {
      setShowPaymentModal(false)
      setPaymentError('')
      stripeElements = null
    }
  }

  onCleanup(() => {
    stripeElements = null
  })

  return (
    <div class={styles.section}>
      <Fieldset legend="Mythweavers">
        <div class={styles.settingRow}>
          <label class={styles.label}>Balance</label>
          <Show when={balance() !== undefined} fallback={<span class={styles.balanceValue}>Loading...</span>}>
            <div class={styles.balanceRow}>
              <span class={styles.balanceValue}>
                {balance() !== null ? `$${balance()!.toFixed(2)}` : 'Unavailable'}
              </span>
              <Show when={!showTopUp()}>
                <Button variant="secondary" size="sm" onClick={() => setShowTopUp(true)}>
                  Top Up
                </Button>
              </Show>
              <Button variant="ghost" size="sm" onClick={() => refetchBalance()}>
                Refresh
              </Button>
              <Button variant="ghost" size="sm" onClick={() => navigate('/usage')}>
                Usage History
              </Button>
            </div>
          </Show>
        </div>

        <Show when={showTopUp()}>
          <div class={styles.settingRow}>
            <label class={styles.label}>Amount</label>
            <div class={styles.topUpPresets}>
              <For each={TOPUP_PRESETS}>
                {(preset) => (
                  <button
                    class={`${styles.presetButton} ${topUpAmount() === preset ? styles.presetButtonActive : ''}`}
                    onClick={() => selectPreset(preset)}
                  >
                    ${preset}
                  </button>
                )}
              </For>
              <input
                type="number"
                min="1"
                max="500"
                step="0.01"
                value={customAmount()}
                onInput={(e) => handleCustomInput(e.target.value)}
                class={styles.customAmountInput}
                placeholder="Custom"
              />
            </div>
          </div>

          <Show when={effectiveAmount() && modelEstimates().length > 0}>
            <div class={styles.settingRow}>
              <label class={styles.label}>Estimated output</label>
              <div class={styles.estimatesTable}>
                <For each={modelEstimates()}>
                  {(est) => (
                    <div class={styles.estimateRow}>
                      <span class={styles.estimateModel}>{est.name}</span>
                      <span class={styles.estimateValue}>
                        ~
                        {est.words >= 1_000_000
                          ? `${(est.words / 1_000_000).toFixed(1)}m`
                          : est.words >= 1_000
                            ? `${(est.words / 1_000).toFixed(0)}k`
                            : est.words}{' '}
                        words
                      </span>
                    </div>
                  )}
                </For>
              </div>
            </div>
          </Show>

          <div class={styles.balanceRow}>
            <Button
              variant="primary"
              size="sm"
              onClick={handleContinueToPayment}
              disabled={!effectiveAmount() || isProcessing()}
            >
              {isProcessing()
                ? 'Loading...'
                : effectiveAmount()
                  ? `Continue — $${effectiveAmount()!.toFixed(2)}`
                  : 'Select an amount'}
            </Button>
            <Button variant="ghost" size="sm" onClick={resetTopUp}>
              Cancel
            </Button>
          </div>

          <Show when={paymentError() && !showPaymentModal()}>
            <div class={styles.errorText}>{paymentError()}</div>
          </Show>
        </Show>
      </Fieldset>

      <Modal
        open={showPaymentModal()}
        onClose={closePaymentModal}
        title={`Top Up — $${effectiveAmount()?.toFixed(2) ?? '0.00'}`}
      >
        <div class={styles.paymentModalContent}>
          <Show when={paymentStatus() !== 'success'}>
            <div ref={paymentElementContainer} class={styles.paymentElement} />
            <Show when={paymentError()}>
              <div class={styles.errorText}>{paymentError()}</div>
            </Show>
            <Button variant="primary" onClick={handleConfirmPayment} disabled={paymentStatus() === 'processing'}>
              {paymentStatus() === 'processing' ? 'Processing...' : `Pay $${effectiveAmount()?.toFixed(2) ?? '0.00'}`}
            </Button>
          </Show>

          <Show when={paymentStatus() === 'success'}>
            <div class={styles.successText}>Payment successful! Your balance has been updated.</div>
            <Button variant="secondary" onClick={resetTopUp}>
              Done
            </Button>
          </Show>
        </div>
      </Modal>

      <Fieldset legend="OpenRouter">
        <div class={styles.settingRow}>
          <label class={styles.label}>API Key</label>
          <SecretInput
            value={settingsStore.openrouterApiKey}
            onChange={settingsStore.setOpenrouterApiKey}
            placeholder="sk-or-..."
          />
        </div>
      </Fieldset>

      <Fieldset legend="Anthropic">
        <div class={styles.settingRow}>
          <label class={styles.label}>API Key</label>
          <SecretInput
            value={settingsStore.anthropicApiKey}
            onChange={settingsStore.setAnthropicApiKey}
            placeholder="sk-ant-..."
          />
        </div>
      </Fieldset>

      <Fieldset legend="OpenAI">
        <div class={styles.settingRow}>
          <label class={styles.label}>API Key</label>
          <SecretInput
            value={settingsStore.openaiApiKey}
            onChange={settingsStore.setOpenaiApiKey}
            placeholder="sk-..."
          />
        </div>
      </Fieldset>

      <Fieldset legend="Cloudflare">
        <div class={styles.settingRow}>
          <label class={styles.label}>API Key</label>
          <SecretInput
            value={settingsStore.cloudflareApiKey}
            onChange={settingsStore.setCloudflareApiKey}
            placeholder="cfut_..."
          />
        </div>
        <div class={styles.settingRow}>
          <label class={styles.label}>Endpoint</label>
          <input
            type="text"
            value={settingsStore.cloudflareEndpoint}
            onChange={(e) => settingsStore.setCloudflareEndpoint(e.target.value)}
            class={styles.input}
            placeholder="https://api.cloudflare.com/client/v4/accounts/<ACCOUNT_ID>/ai"
          />
        </div>
      </Fieldset>

      {(() => {
        const hasKeys = () =>
          !!(
            settingsStore.openrouterApiKey ||
            settingsStore.anthropicApiKey ||
            settingsStore.openaiApiKey ||
            settingsStore.cloudflareApiKey
          )
        return (
          <>
            {/* Encryption prompt — shown when authenticated, has keys, but no encryption key in memory */}
            <Show
              when={
                authStore.isAuthenticated &&
                !authStore.isOfflineMode &&
                settingsStore.isEncryptionAvailable() &&
                !settingsStore.hasEncryptionKey() &&
                hasKeys()
              }
            >
              <div class={styles.settingRow} style={{ 'margin-top': '0.5rem' }}>
                <div class={styles.successText} style={{ color: 'var(--color-text-secondary)', 'text-align': 'left' }}>
                  Your API keys are only stored on this device. Enter your password to encrypt them locally and sync the
                  encrypted keys to the server.
                </div>
                <Button variant="primary" size="sm" onClick={() => setShowEncryptPrompt(true)}>
                  Encrypt & Sync Keys
                </Button>
              </div>
            </Show>

            {/* Insecure origin — encryption unavailable, keys stay device-local */}
            <Show
              when={
                authStore.isAuthenticated &&
                !authStore.isOfflineMode &&
                !settingsStore.isEncryptionAvailable() &&
                hasKeys()
              }
            >
              <div class={styles.settingRow} style={{ 'margin-top': '0.5rem' }}>
                <div class={styles.successText} style={{ color: 'var(--color-text-secondary)', 'text-align': 'left' }}>
                  Encrypted key sync is unavailable on this connection (requires HTTPS or localhost). Your API keys are
                  kept on this device only and are not synced to the server.
                </div>
              </div>
            </Show>
          </>
        )
      })()}

      <Show when={showEncryptPrompt()}>
        <PasswordForEncryptionDialog mode="encrypt" onClose={() => setShowEncryptPrompt(false)} />
      </Show>
    </div>
  )
}

/**
 * Composite component that combines provider, API keys, and default model selection.
 * Used in standalone contexts (e.g. AdventurePage) where all three are needed together.
 */
interface ProviderModelSelectorProps {
  autoFetchModels?: boolean
}

export const ProviderModelSelector: Component<ProviderModelSelectorProps> = (props) => {
  return (
    <div class={styles.section}>
      <ProviderSelector autoFetchModels={props.autoFetchModels} />
      <ApiKeys />
      <div class={styles.settingRow}>
        <label class={styles.label}>Default Model</label>
        <ModelSelector
          model={settingsStore.model}
          setModel={settingsStore.setModel}
          availableModels={modelsStore.availableModels}
          isLoadingModels={modelsStore.isLoadingModels}
          onRefreshModels={() => modelsStore.fetchModels()}
        />
      </div>
    </div>
  )
}
