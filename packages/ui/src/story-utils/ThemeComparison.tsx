import type { ParentComponent } from 'solid-js'
import { ThemeClassContext } from '../theme/ThemeClassContext'
import { chronicleTheme } from '../theme/chronicle.css'
import { starlightTheme } from '../theme/starlight.css'
import { tokens } from '../theme/tokens.css'

const ThemeWrapper: ParentComponent<{ theme: string; name: string }> = (props) => (
  <ThemeClassContext.Provider value={() => props.theme}>
    <div
      class={props.theme}
      style={{
        padding: '1rem',
        'background-color': tokens.color.bg.base,
        color: tokens.color.text.primary,
        'border-radius': '8px',
        display: 'flex',
        'flex-direction': 'column',
        gap: '0.5rem',
      }}
    >
      <div style={{ 'font-size': '12px', opacity: 0.7 }}>{props.name}</div>
      <div style={{ display: 'flex', 'flex-direction': 'column', gap: '0.5rem', 'align-items': 'flex-start' }}>
        {props.children}
      </div>
    </div>
  </ThemeClassContext.Provider>
)

/**
 * Renders children side by side in both Chronicle (dark) and Starlight (light) themes.
 * Content inside each theme box stacks vertically.
 *
 * Usage:
 * ```tsx
 * <ThemeComparison>
 *   <Button>Click me</Button>
 * </ThemeComparison>
 * ```
 */
export const ThemeComparison: ParentComponent = (props) => (
  <div style={{ display: 'flex', gap: '1rem', 'flex-wrap': 'wrap' }}>
    <ThemeWrapper theme={chronicleTheme} name="Chronicle (Dark)">
      {props.children}
    </ThemeWrapper>
    <ThemeWrapper theme={starlightTheme} name="Starlight (Light)">
      {props.children}
    </ThemeWrapper>
  </div>
)
