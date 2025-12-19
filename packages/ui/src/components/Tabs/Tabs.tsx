import { type JSX, type ParentComponent, Show, createContext, createSignal, useContext } from 'solid-js'
import * as styles from './Tabs.css'

export type TabsVariant = 'underline' | 'pills'

// Context for sharing state between Tabs components
interface TabsContextValue {
  activeTab: () => string
  setActiveTab: (id: string) => void
  variant: () => TabsVariant
  toggleable: () => boolean
}

const TabsContext = createContext<TabsContextValue>()

const useTabsContext = () => {
  const ctx = useContext(TabsContext)
  if (!ctx) throw new Error('Tabs components must be used within a Tabs provider')
  return ctx
}

// Main Tabs container
export interface TabsProps {
  /** Tab style variant */
  variant?: TabsVariant
  /** Default active tab ID */
  defaultTab?: string
  /** Controlled active tab ID */
  activeTab?: string
  /** Called when tab changes */
  onTabChange?: (tabId: string) => void
  /** Allow clicking active tab to deselect it */
  toggleable?: boolean
  /** Additional class */
  class?: string
  /** Inline styles */
  style?: JSX.CSSProperties
  children: JSX.Element
}

export const Tabs: ParentComponent<TabsProps> = (props) => {
  const [internalTab, setInternalTab] = createSignal(props.defaultTab ?? '')

  const activeTab = () => props.activeTab ?? internalTab()
  const setActiveTab = (id: string) => {
    if (props.activeTab === undefined) {
      setInternalTab(id)
    }
    props.onTabChange?.(id)
  }

  const variant = () => props.variant ?? 'underline'
  const toggleable = () => props.toggleable ?? false

  return (
    <TabsContext.Provider value={{ activeTab, setActiveTab, variant, toggleable }}>
      <div class={`${styles.container} ${props.class ?? ''}`} style={props.style}>
        {props.children}
      </div>
    </TabsContext.Provider>
  )
}

// Tab list container
export interface TabListProps {
  /** Accessible label for the tab list */
  'aria-label'?: string
  /** Inline styles */
  style?: JSX.CSSProperties
  children: JSX.Element
}

export const TabList: ParentComponent<TabListProps> = (props) => {
  const ctx = useTabsContext()

  return (
    <div
      class={styles.tabList({ variant: ctx.variant() })}
      role="tablist"
      aria-label={props['aria-label']}
      style={props.style}
    >
      {props.children}
    </div>
  )
}

// Individual tab button
export interface TabProps {
  /** Unique tab ID */
  id: string
  /** Disabled state */
  disabled?: boolean
  /** Icon to display */
  icon?: JSX.Element
  children: JSX.Element
}

export const Tab: ParentComponent<TabProps> = (props) => {
  const ctx = useTabsContext()
  const panelId = `panel-${props.id}`

  const isSelected = () => ctx.activeTab() === props.id

  const handleClick = () => {
    if (props.disabled) return
    // If toggleable and already selected, deselect
    if (ctx.toggleable() && isSelected()) {
      ctx.setActiveTab('')
    } else {
      ctx.setActiveTab(props.id)
    }
  }

  return (
    <button
      class={styles.tab({ variant: ctx.variant() })}
      role="tab"
      id={props.id}
      aria-selected={isSelected()}
      aria-controls={panelId}
      data-selected={isSelected()}
      disabled={props.disabled}
      onClick={handleClick}
    >
      {props.icon}
      {props.children}
    </button>
  )
}

// Tab panel content
export interface TabPanelProps {
  /** Must match the Tab id */
  id: string
  /** Additional class */
  class?: string
  /** Inline styles */
  style?: JSX.CSSProperties
  children: JSX.Element
}

export const TabPanel: ParentComponent<TabPanelProps> = (props) => {
  const ctx = useTabsContext()
  const tabId = props.id
  const panelId = `panel-${props.id}`

  return (
    <Show when={ctx.activeTab() === props.id}>
      <div
        class={`${styles.tabPanel} ${props.class ?? ''}`}
        role="tabpanel"
        id={panelId}
        aria-labelledby={tabId}
        style={props.style}
      >
        {props.children}
      </div>
    </Show>
  )
}
