import { Badge, Card, CardBody, Stack, Tab, TabList, TabPanel, Tabs } from '@mythweavers/ui'
import { BsChevronDown, BsChevronRight } from 'solid-icons/bs'
import { Component, For, Show, createMemo, createSignal } from 'solid-js'
import { useContextMessage } from '../hooks/useContextMessage'
import { currentStoryStore } from '../stores/currentStoryStore'

export const ScriptHelpTabs: Component = () => {
  const [activeTab, setActiveTab] = createSignal('')
  const [expandedSection, setExpandedSection] = createSignal<string | null>('basics')
  const contextMessageId = useContextMessage()

  const toggleSection = (section: string) => {
    setExpandedSection(expandedSection() === section ? null : section)
  }

  const availableFunctions = createMemo(() => {
    const messageId = contextMessageId()
    if (!messageId) {
      return []
    }

    let functions: Record<string, Function> = {}

    if (currentStoryStore.globalScript) {
      try {
        const scriptFunction = eval(`(${currentStoryStore.globalScript})`)
        if (typeof scriptFunction === 'function') {
          const data = {}
          const result = scriptFunction(data, {})
          if (result && typeof result === 'object' && 'functions' in result) {
            functions = result.functions || {}
          }
        }
      } catch (error) {
        console.error('Error evaluating global script for functions:', error)
      }
    }

    return Object.entries(functions).map(([name, func]) => {
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

  const sectionHeaderStyle = {
    display: 'flex',
    'align-items': 'center',
    gap: '0.5rem',
    width: '100%',
    padding: '0.5rem',
    background: 'var(--bg-secondary)',
    border: 'none',
    'border-radius': '4px',
    cursor: 'pointer',
    'font-weight': '600',
    color: 'var(--text-primary)',
    'font-size': '0.9rem',
  }

  const codeStyle = {
    display: 'block',
    background: 'var(--bg-tertiary)',
    padding: '0.5rem',
    'border-radius': '4px',
    'font-family': 'monospace',
    'font-size': '0.85rem',
    'white-space': 'pre-wrap' as const,
    color: 'var(--text-primary)',
  }

  return (
    <Tabs activeTab={activeTab()} onTabChange={setActiveTab} toggleable variant="pills">
      <TabList>
        <Tab id="ejs">EJS Script Help</Tab>
        <Tab id="functions">
          Functions
          <Show when={availableFunctions().length > 0}>
            <Badge variant="default" size="sm" style={{ 'margin-left': '0.5rem' }}>
              {availableFunctions().length}
            </Badge>
          </Show>
        </Tab>
      </TabList>

      <TabPanel id="ejs">
        <Card style={{ 'margin-top': '0.5rem' }}>
          <CardBody>
            <Stack gap="sm">
              {/* Basics */}
              <div>
                <button style={sectionHeaderStyle} onClick={() => toggleSection('basics')}>
                  <span>{expandedSection() === 'basics' ? <BsChevronDown /> : <BsChevronRight />}</span>
                  Basics
                </button>
                <Show when={expandedSection() === 'basics'}>
                  <div style={{ padding: '0.75rem', color: 'var(--text-secondary)', 'font-size': '0.9rem' }}>
                    <p style={{ margin: '0 0 0.5rem 0' }}>
                      EJS templates allow dynamic content in character descriptions and story elements.
                    </p>
                    <code style={codeStyle}>{'<%= expression %>'} - Outputs the result</code>
                    <code style={{ ...codeStyle, 'margin-top': '0.25rem' }}>
                      {'<% code %>'} - Executes JavaScript code
                    </code>
                    <code style={{ ...codeStyle, 'margin-top': '0.25rem' }}>
                      {'<%- html %>'} - Outputs unescaped HTML
                    </code>
                  </div>
                </Show>
              </div>

              {/* Variables */}
              <div>
                <button style={sectionHeaderStyle} onClick={() => toggleSection('variables')}>
                  <span>{expandedSection() === 'variables' ? <BsChevronDown /> : <BsChevronRight />}</span>
                  How Variables Work
                </button>
                <Show when={expandedSection() === 'variables'}>
                  <div style={{ padding: '0.75rem', color: 'var(--text-secondary)', 'font-size': '0.9rem' }}>
                    <p style={{ margin: '0 0 0.5rem 0' }}>Variables are defined by your scripts:</p>
                    <div style={{ 'margin-bottom': '0.25rem' }}>
                      <strong>Global Script</strong> - Sets up initial variables and functions available everywhere
                    </div>
                    <div style={{ 'margin-bottom': '0.25rem' }}>
                      <strong>Message Scripts</strong> - Modify data as the story progresses
                    </div>
                    <div style={{ 'margin-bottom': '0.5rem' }}>
                      <strong>Data Object</strong> - Accumulates all script changes up to the current point
                    </div>
                  </div>
                </Show>
              </div>

              {/* Functions */}
              <div>
                <button style={sectionHeaderStyle} onClick={() => toggleSection('functions')}>
                  <span>{expandedSection() === 'functions' ? <BsChevronDown /> : <BsChevronRight />}</span>
                  Using Functions in Templates
                </button>
                <Show when={expandedSection() === 'functions'}>
                  <div style={{ padding: '0.75rem', color: 'var(--text-secondary)', 'font-size': '0.9rem' }}>
                    <p style={{ margin: '0 0 0.5rem 0' }}>
                      You can add functions to the data object in your Global Script:
                    </p>
                    <div style={{ 'margin-bottom': '0.25rem', 'font-weight': '500' }}>Example Global Script:</div>
                    <code style={codeStyle}>{`(data) => {
  data.random = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min
  data.choose = (array) => array[Math.floor(Math.random() * array.length)]
  data.health = 100
}`}</code>
                    <div style={{ 'margin-top': '0.5rem', 'font-weight': '500' }}>Using in templates:</div>
                    <code style={{ ...codeStyle, 'margin-top': '0.25rem' }}>{'<%= random(1, 10) %>'}</code>
                  </div>
                </Show>
              </div>

              {/* Examples */}
              <div>
                <button style={sectionHeaderStyle} onClick={() => toggleSection('examples')}>
                  <span>{expandedSection() === 'examples' ? <BsChevronDown /> : <BsChevronRight />}</span>
                  Examples
                </button>
                <Show when={expandedSection() === 'examples'}>
                  <div style={{ padding: '0.75rem', color: 'var(--text-secondary)', 'font-size': '0.9rem' }}>
                    <div style={{ 'margin-bottom': '0.25rem', 'font-weight': '500' }}>Using script data:</div>
                    <code style={codeStyle}>{'A warrior with <%= strength || 10 %> strength'}</code>
                    <div style={{ 'margin-top': '0.5rem', 'margin-bottom': '0.25rem', 'font-weight': '500' }}>
                      Conditional:
                    </div>
                    <code style={codeStyle}>{'<% if (daysPassed > 5) { %>Experienced<% } else { %>Novice<% } %>'}</code>
                  </div>
                </Show>
              </div>
            </Stack>
          </CardBody>
        </Card>
      </TabPanel>

      <TabPanel id="functions">
        <Card variant="outlined" style={{ 'margin-top': '0.5rem' }}>
          <Show
            when={availableFunctions().length > 0}
            fallback={
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
            }
          >
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
          </Show>
        </Card>
      </TabPanel>
    </Tabs>
  )
}
