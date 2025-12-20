import { Button, Card, CardBody, Stack } from '@mythweavers/ui'
import { BsChevronDown, BsChevronRight, BsQuestionCircle } from 'solid-icons/bs'
import { Component, Show, createSignal } from 'solid-js'
import * as styles from './EJSDocumentation.css'

export const EJSDocumentation: Component = () => {
  const [showDocs, setShowDocs] = createSignal(false)
  const [expandedSection, setExpandedSection] = createSignal<string | null>('basics')

  const toggleSection = (section: string) => {
    setExpandedSection(expandedSection() === section ? null : section)
  }

  return (
    <div>
      <Button variant="ghost" size="sm" onClick={() => setShowDocs(!showDocs())} title="Toggle EJS documentation">
        <BsQuestionCircle />
        EJS Script Help
      </Button>

      <Show when={showDocs()}>
        <Card style={{ 'margin-top': '0.5rem' }}>
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
                    <p class={styles.paragraph}>
                      EJS templates allow dynamic content in character descriptions and story elements.
                    </p>
                    <code class={styles.codeBlock}>{'<%= expression %>'} - Outputs the result</code>
                    <code class={styles.codeBlockMargin}>{'<% code %>'} - Executes JavaScript code</code>
                    <code class={styles.codeBlockMargin}>{'<%- html %>'} - Outputs unescaped HTML</code>
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
                    <p class={styles.paragraph}>Variables are defined by your scripts:</p>
                    <div class={styles.subheading}>
                      <strong>Global Script</strong> - Sets up initial variables and functions available everywhere
                    </div>
                    <div class={styles.subheading}>
                      <strong>Message Scripts</strong> - Modify data as the story progresses
                    </div>
                    <div style={{ 'margin-bottom': '0.5rem' }}>
                      <strong>Data Object</strong> - Accumulates all script changes up to the current point
                    </div>
                    <p class={styles.tipText}>💡 Use the preview below to see what variables are currently available</p>
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
                    <p class={styles.paragraph}>You can add functions to the data object in your Global Script:</p>
                    <div class={styles.subheading}>Example Global Script:</div>
                    <code class={styles.codeBlock}>{`(data) => {
  data.random = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min
  data.choose = (array) => array[Math.floor(Math.random() * array.length)]
  data.health = 100
}`}</code>
                    <div class={styles.exampleHeading}>Using in templates:</div>
                    <code class={styles.codeBlockMargin}>{'<%= random(1, 10) %>'}</code>
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
                    <div class={styles.subheading}>Using script data:</div>
                    <code class={styles.codeBlock}>{'A warrior with <%= strength || 10 %> strength'}</code>
                    <div class={styles.exampleHeading}>Conditional:</div>
                    <code class={styles.codeBlock}>{'<% if (daysPassed > 5) { %>Experienced<% } else { %>Novice<% } %>'}</code>
                  </div>
                </Show>
              </div>
            </Stack>
          </CardBody>
        </Card>
      </Show>
    </div>
  )
}
