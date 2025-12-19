import { Badge, Button, Card, CardBody, Stack } from '@mythweavers/ui'
import { BsCodeSlash } from 'solid-icons/bs'
import { Component, For, Show, createMemo, createSignal } from 'solid-js'
import { useContextMessage } from '../hooks/useContextMessage'
import { currentStoryStore } from '../stores/currentStoryStore'

export const AvailableFunctions: Component = () => {
  const [showFunctions, setShowFunctions] = createSignal(false)
  const contextMessageId = useContextMessage()

  const availableFunctions = createMemo(() => {
    const messageId = contextMessageId()
    if (!messageId) {
      return []
    }

    // Execute scripts to get the current data and functions
    let functions: Record<string, Function> = {}

    // Execute global script first to get functions
    if (currentStoryStore.globalScript) {
      try {
        const scriptFunction = eval(`(${currentStoryStore.globalScript})`)
        if (typeof scriptFunction === 'function') {
          // Create a draft data object for the global script
          const data = {}
          const result = scriptFunction(data, {})

          // Check if it returns functions
          if (result && typeof result === 'object' && 'functions' in result) {
            functions = result.functions || {}
          }
        }
      } catch (error) {
        console.error('Error evaluating global script for functions:', error)
      }
    }

    // Extract function signatures
    return Object.entries(functions).map(([name, func]) => {
      // Try to extract parameter names from function
      const funcStr = func.toString()
      const match = funcStr.match(/^(?:function\s*)?(?:\w+\s*)?\(([^)]*)\)/)
      const params = match
        ? match[1]
            .split(',')
            .map((p) => p.trim())
            .filter(Boolean)
        : []

      return {
        name,
        params,
        signature: `${name}(${params.join(', ')})`,
      }
    })
  })

  return (
    <div style={{ margin: '0.5rem 0' }}>
      <Button
        variant="secondary"
        size="sm"
        onClick={() => setShowFunctions(!showFunctions())}
        title="Toggle available functions"
      >
        <BsCodeSlash />
        <span style={{ 'margin-left': '0.5rem' }}>Available Functions</span>
        <Show when={availableFunctions().length > 0}>
          <span style={{ 'margin-left': '0.5rem' }}>
            <Badge variant="default">{availableFunctions().length}</Badge>
          </span>
        </Show>
      </Button>

      <Show when={showFunctions() && availableFunctions().length > 0}>
        <Card variant="outlined" style={{ 'margin-top': '0.75rem' }}>
          <CardBody padding="md" gap="sm">
            <div
              style={{
                'font-size': '0.875rem',
                color: 'var(--text-secondary)',
                'font-weight': '500',
                'margin-bottom': '0.5rem',
              }}
            >
              Functions from Global Script:
            </div>
            <Stack direction="vertical" gap="xs">
              <For each={availableFunctions()}>
                {(func) => (
                  <div style={{ padding: '0.25rem 0' }}>
                    <code
                      style={{
                        'font-family': 'monospace',
                        'font-size': '0.8125rem',
                        color: 'var(--accent-color)',
                        background: 'var(--bg-primary)',
                        padding: '0.25rem 0.5rem',
                        'border-radius': '3px',
                        display: 'inline-block',
                      }}
                    >
                      functions.{func.signature}
                    </code>
                  </div>
                )}
              </For>
            </Stack>
            <div
              style={{
                'margin-top': '1rem',
                'padding-top': '0.75rem',
                'border-top': '1px solid var(--border-color)',
                'font-size': '0.75rem',
                color: 'var(--text-muted)',
              }}
            >
              Use these in EJS templates like:{' '}
              <code
                style={{
                  'font-family': 'monospace',
                  background: 'var(--bg-primary)',
                  padding: '0.125rem 0.25rem',
                  'border-radius': '2px',
                  color: 'var(--text-secondary)',
                }}
              >
                {`<%= functions.${availableFunctions()[0]?.name || 'functionName'}(...) %>`}
              </code>
            </div>
          </CardBody>
        </Card>
      </Show>

      <Show when={showFunctions() && availableFunctions().length === 0}>
        <Card variant="outlined" style={{ 'margin-top': '0.75rem' }}>
          <CardBody padding="md">
            <div
              style={{
                color: 'var(--text-muted)',
                'font-size': '0.875rem',
                'text-align': 'center',
              }}
            >
              No functions available. Define functions in your Global Script to use them in templates.
            </div>
          </CardBody>
        </Card>
      </Show>
    </div>
  )
}
