import { Component, createSignal, Show } from 'solid-js'
import { BsQuestionCircle, BsChevronDown, BsChevronRight } from 'solid-icons/bs'
import styles from './EJSDocumentation.module.css'

export const EJSDocumentation: Component = () => {
  const [showDocs, setShowDocs] = createSignal(false)
  const [expandedSection, setExpandedSection] = createSignal<string | null>('basics')

  const toggleSection = (section: string) => {
    setExpandedSection(expandedSection() === section ? null : section)
  }

  return (
    <div class={styles.container}>
      <button
        type="button"
        class={styles.toggleButton}
        onClick={() => setShowDocs(!showDocs())}
        title="Toggle EJS documentation"
      >
        <BsQuestionCircle />
        EJS Script Help
      </button>

      <Show when={showDocs()}>
        <div class={styles.documentation}>
          <div class={styles.section}>
            <button
              class={styles.sectionHeader}
              onClick={() => toggleSection('basics')}
            >
              <span class={styles.chevron}>
                {expandedSection() === 'basics' ? <BsChevronDown /> : <BsChevronRight />}
              </span>
              Basics
            </button>
            <Show when={expandedSection() === 'basics'}>
              <div class={styles.sectionContent}>
                <p>EJS templates allow dynamic content in character descriptions and story elements.</p>
                <div class={styles.example}>
                  <code>{'<%= expression %>'}</code> - Outputs the result
                </div>
                <div class={styles.example}>
                  <code>{'<% code %>'}</code> - Executes JavaScript code
                </div>
                <div class={styles.example}>
                  <code>{'<%- html %>'}</code> - Outputs unescaped HTML
                </div>
              </div>
            </Show>
          </div>

          <div class={styles.section}>
            <button
              class={styles.sectionHeader}
              onClick={() => toggleSection('variables')}
            >
              <span class={styles.chevron}>
                {expandedSection() === 'variables' ? <BsChevronDown /> : <BsChevronRight />}
              </span>
              How Variables Work
            </button>
            <Show when={expandedSection() === 'variables'}>
              <div class={styles.sectionContent}>
                <p>Variables are defined by your scripts:</p>
                <div class={styles.varItem}>
                  <strong>Global Script</strong> - Sets up initial variables and functions available everywhere
                </div>
                <div class={styles.varItem}>
                  <strong>Message Scripts</strong> - Modify data as the story progresses
                </div>
                <div class={styles.varItem}>
                  <strong>Data Object</strong> - Accumulates all script changes up to the current point
                </div>
                <p class={styles.hint}>
                  💡 Use the preview below to see what variables are currently available in your story's data object
                </p>
              </div>
            </Show>
          </div>

          <div class={styles.section}>
            <button
              class={styles.sectionHeader}
              onClick={() => toggleSection('functions')}
            >
              <span class={styles.chevron}>
                {expandedSection() === 'functions' ? <BsChevronDown /> : <BsChevronRight />}
              </span>
              Using Functions in Templates
            </button>
            <Show when={expandedSection() === 'functions'}>
              <div class={styles.sectionContent}>
                <p>You can add functions to the data object in your Global Script:</p>
                <div class={styles.funcItem}>
                  <div class={styles.funcDesc}>Example Global Script:</div>
                  <code class={styles.funcExample}>{`(data) => {
  // Add functions to data for use in templates
  data.random = (min, max) => {
    return Math.floor(Math.random() * (max - min + 1)) + min
  }
  data.choose = (array) => {
    return array[Math.floor(Math.random() * array.length)]
  }
  
  // Initialize other variables
  data.health = 100
  data.daysPassed = 0
}`}</code>
                </div>
                <div class={styles.funcItem}>
                  <div class={styles.funcDesc}>Using in templates:</div>
                  <div class={styles.funcExample}>{"<%= random(1, 10) %>"}</div>
                  <div class={styles.funcExample}>{"<%= choose(['red', 'blue']) %>"}</div>
                </div>
                <p class={styles.hint}>
                  💡 Check your Global Script to see what functions are available
                </p>
              </div>
            </Show>
          </div>

          <div class={styles.section}>
            <button
              class={styles.sectionHeader}
              onClick={() => toggleSection('examples')}
            >
              <span class={styles.chevron}>
                {expandedSection() === 'examples' ? <BsChevronDown /> : <BsChevronRight />}
              </span>
              Examples
            </button>
            <Show when={expandedSection() === 'examples'}>
              <div class={styles.sectionContent}>
                <div class={styles.exampleItem}>
                  <div class={styles.exampleTitle}>Using script data:</div>
                  <code class={styles.exampleCode}>
                    {`A warrior with <%= strength || 10 %> strength`}
                  </code>
                </div>
                <div class={styles.exampleItem}>
                  <div class={styles.exampleTitle}>Conditional description:</div>
                  <code class={styles.exampleCode}>
{`<% if (daysPassed > 5) { %>
  An experienced warrior
<% } else { %>
  A nervous newcomer
<% } %>`}
                  </code>
                </div>
                <div class={styles.exampleItem}>
                  <div class={styles.exampleTitle}>Using custom functions:</div>
                  <code class={styles.exampleCode}>
{`Wearing <%= choose ? choose(['red', 'blue', 'green']) : 'leather' %> armor
Health: <%= health || 100 %>%`}
                  </code>
                </div>
              </div>
            </Show>
          </div>
        </div>
      </Show>
    </div>
  )
}