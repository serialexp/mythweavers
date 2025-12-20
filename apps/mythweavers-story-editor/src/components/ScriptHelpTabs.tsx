import { Badge, Card, CardBody, Stack, Tab, TabList, TabPanel, Tabs } from '@mythweavers/ui'
import { BsChevronDown, BsChevronRight } from 'solid-icons/bs'
import { Component, For, Show, createMemo, createSignal } from 'solid-js'
import { useContextMessage } from '../hooks/useContextMessage'
import { currentStoryStore } from '../stores/currentStoryStore'
import * as styles from './ScriptHelpTabs.css'

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
        <Card class={styles.cardMargin}>
          <CardBody>
            <Stack gap="sm">
              {/* Basics */}
              <div>
                <button class={styles.sectionHeader} onClick={() => toggleSection('basics')}>
                  <span>{expandedSection() === 'basics' ? <BsChevronDown /> : <BsChevronRight />}</span>
                  Basics
                </button>
                <Show when={expandedSection() === 'basics'}>
                  <div class={styles.sectionContent}>
                    <p class={styles.sectionParagraph}>
                      EJS templates allow dynamic content in character descriptions and story elements.
                    </p>
                    <code class={styles.codeBlock}>{'<%= expression %>'} - Outputs the result</code>
                    <code class={styles.codeBlockSpaced}>
                      {'<% code %>'} - Executes JavaScript code
                    </code>
                    <code class={styles.codeBlockSpaced}>
                      {'<%- html %>'} - Outputs unescaped HTML
                    </code>
                  </div>
                </Show>
              </div>

              {/* Variables */}
              <div>
                <button class={styles.sectionHeader} onClick={() => toggleSection('variables')}>
                  <span>{expandedSection() === 'variables' ? <BsChevronDown /> : <BsChevronRight />}</span>
                  How Variables Work
                </button>
                <Show when={expandedSection() === 'variables'}>
                  <div class={styles.sectionContent}>
                    <p class={styles.sectionParagraph}>Variables are defined by your scripts:</p>
                    <div class={styles.sectionLabel}>
                      <strong>Global Script</strong> - Sets up initial variables and functions available everywhere
                    </div>
                    <div class={styles.sectionLabel}>
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
                <button class={styles.sectionHeader} onClick={() => toggleSection('functions')}>
                  <span>{expandedSection() === 'functions' ? <BsChevronDown /> : <BsChevronRight />}</span>
                  Using Functions in Templates
                </button>
                <Show when={expandedSection() === 'functions'}>
                  <div class={styles.sectionContent}>
                    <p class={styles.sectionParagraph}>
                      You can add functions to the data object in your Global Script:
                    </p>
                    <div class={styles.sectionLabel}>Example Global Script:</div>
                    <code class={styles.codeBlock}>{`(data) => {
  data.random = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min
  data.choose = (array) => array[Math.floor(Math.random() * array.length)]
  data.health = 100
}`}</code>
                    <div style={{ 'margin-top': '0.5rem', 'font-weight': '500' }}>Using in templates:</div>
                    <code class={styles.codeBlockSpaced}>{'<%= random(1, 10) %>'}</code>
                  </div>
                </Show>
              </div>

              {/* Examples */}
              <div>
                <button class={styles.sectionHeader} onClick={() => toggleSection('examples')}>
                  <span>{expandedSection() === 'examples' ? <BsChevronDown /> : <BsChevronRight />}</span>
                  Examples
                </button>
                <Show when={expandedSection() === 'examples'}>
                  <div class={styles.sectionContent}>
                    <div class={styles.sectionLabel}>Using script data:</div>
                    <code class={styles.codeBlock}>{'A warrior with <%= strength || 10 %> strength'}</code>
                    <div style={{ 'margin-top': '0.5rem', 'margin-bottom': '0.25rem', 'font-weight': '500' }}>
                      Conditional:
                    </div>
                    <code class={styles.codeBlock}>{'<% if (daysPassed > 5) { %>Experienced<% } else { %>Novice<% } %>'}</code>
                  </div>
                </Show>
              </div>
            </Stack>
          </CardBody>
        </Card>
      </TabPanel>

      <TabPanel id="functions">
        <Card variant="outlined" class={styles.cardMargin}>
          <Show
            when={availableFunctions().length > 0}
            fallback={
              <CardBody padding="md">
                <div class={styles.emptyMessage}>
                  No functions available. Define functions in your Global Script to use them in templates.
                </div>
              </CardBody>
            }
          >
            <CardBody padding="md" gap="sm">
              <div class={styles.functionsLabel}>
                Functions from Global Script:
              </div>
              <Stack direction="vertical" gap="xs">
                <For each={availableFunctions()}>
                  {(func) => (
                    <div class={styles.functionItem}>
                      <code class={styles.functionCode}>
                        functions.{func.signature}
                      </code>
                    </div>
                  )}
                </For>
              </Stack>
              <div class={styles.functionsFooter}>
                Use these in EJS templates like:{' '}
                <code class={styles.inlineCode}>
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
