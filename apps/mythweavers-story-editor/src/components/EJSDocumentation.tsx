import { Button, Card, CardBody, Stack } from '@mythweavers/ui'
import { BsChevronDown, BsChevronRight, BsQuestionCircle } from 'solid-icons/bs'
import { Component, Show, createSignal } from 'solid-js'

export const EJSDocumentation: Component = () => {
  const [showDocs, setShowDocs] = createSignal(false)
  const [expandedSection, setExpandedSection] = createSignal<string | null>('basics')

  const toggleSection = (section: string) => {
    setExpandedSection(expandedSection() === section ? null : section)
  }

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
                    <p style={{ margin: 0, color: 'var(--text-muted)', 'font-style': 'italic' }}>
                      💡 Use the preview below to see what variables are currently available
                    </p>
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
      </Show>
    </div>
  )
}
