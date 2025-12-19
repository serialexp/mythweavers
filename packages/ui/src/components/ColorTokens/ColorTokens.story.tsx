import type { ParentComponent } from 'solid-js'
import { chronicleTheme } from '../../theme/chronicle.css'
import { starlightTheme } from '../../theme/starlight.css'
import { tokens } from '../../theme/tokens.css'

const ColorSwatch = (props: { name: string; color: string }) => (
  <div style={{ display: 'flex', 'align-items': 'center', gap: '0.75rem' }}>
    <div
      style={{
        width: '40px',
        height: '40px',
        'background-color': props.color,
        'border-radius': '6px',
        border: '1px solid rgba(128, 128, 128, 0.3)',
      }}
    />
    <div style={{ display: 'flex', 'flex-direction': 'column', gap: '2px' }}>
      <span style={{ 'font-size': '13px', 'font-weight': '500' }}>{props.name}</span>
    </div>
  </div>
)

const ColorGroup = (props: { title: string; children: any }) => (
  <div style={{ 'margin-bottom': '1.5rem' }}>
    <h3
      style={{
        margin: '0 0 0.75rem 0',
        'font-size': '14px',
        'font-weight': '600',
        'text-transform': 'uppercase',
        'letter-spacing': '0.05em',
        opacity: 0.7,
      }}
    >
      {props.title}
    </h3>
    <div style={{ display: 'flex', 'flex-direction': 'column', gap: '0.5rem' }}>{props.children}</div>
  </div>
)

const ThemePanel: ParentComponent<{ theme: string; name: string }> = (props) => (
  <div
    class={props.theme}
    style={{
      padding: '1.5rem',
      'background-color': tokens.color.bg.base,
      color: tokens.color.text.primary,
      'border-radius': '8px',
      'min-width': '280px',
    }}
  >
    <h2 style={{ margin: '0 0 1.5rem 0', 'font-size': '18px', 'font-weight': '600' }}>{props.name}</h2>
    {props.children}
  </div>
)

const AllColors = () => (
  <>
    <ColorGroup title="Backgrounds">
      <ColorSwatch name="bg.base" color={tokens.color.bg.base} />
      <ColorSwatch name="bg.raised" color={tokens.color.bg.raised} />
      <ColorSwatch name="bg.elevated" color={tokens.color.bg.elevated} />
      <ColorSwatch name="bg.overlay" color={tokens.color.bg.overlay} />
    </ColorGroup>

    <ColorGroup title="Surfaces">
      <ColorSwatch name="surface.default" color={tokens.color.surface.default} />
      <ColorSwatch name="surface.hover" color={tokens.color.surface.hover} />
      <ColorSwatch name="surface.active" color={tokens.color.surface.active} />
      <ColorSwatch name="surface.selected" color={tokens.color.surface.selected} />
    </ColorGroup>

    <ColorGroup title="Text">
      <ColorSwatch name="text.primary" color={tokens.color.text.primary} />
      <ColorSwatch name="text.secondary" color={tokens.color.text.secondary} />
      <ColorSwatch name="text.muted" color={tokens.color.text.muted} />
      <ColorSwatch name="text.inverse" color={tokens.color.text.inverse} />
    </ColorGroup>

    <ColorGroup title="Borders">
      <ColorSwatch name="border.subtle" color={tokens.color.border.subtle} />
      <ColorSwatch name="border.default" color={tokens.color.border.default} />
      <ColorSwatch name="border.strong" color={tokens.color.border.strong} />
      <ColorSwatch name="border.focus" color={tokens.color.border.focus} />
    </ColorGroup>

    <ColorGroup title="Accent">
      <ColorSwatch name="accent.primary" color={tokens.color.accent.primary} />
      <ColorSwatch name="accent.primaryHover" color={tokens.color.accent.primaryHover} />
      <ColorSwatch name="accent.primaryActive" color={tokens.color.accent.primaryActive} />
      <ColorSwatch name="accent.secondary" color={tokens.color.accent.secondary} />
      <ColorSwatch name="accent.secondaryHover" color={tokens.color.accent.secondaryHover} />
      <ColorSwatch name="accent.secondaryActive" color={tokens.color.accent.secondaryActive} />
    </ColorGroup>

    <ColorGroup title="Semantic">
      <ColorSwatch name="semantic.success" color={tokens.color.semantic.success} />
      <ColorSwatch name="semantic.successSubtle" color={tokens.color.semantic.successSubtle} />
      <ColorSwatch name="semantic.warning" color={tokens.color.semantic.warning} />
      <ColorSwatch name="semantic.warningSubtle" color={tokens.color.semantic.warningSubtle} />
      <ColorSwatch name="semantic.error" color={tokens.color.semantic.error} />
      <ColorSwatch name="semantic.errorSubtle" color={tokens.color.semantic.errorSubtle} />
      <ColorSwatch name="semantic.info" color={tokens.color.semantic.info} />
      <ColorSwatch name="semantic.infoSubtle" color={tokens.color.semantic.infoSubtle} />
    </ColorGroup>
  </>
)

export default (props: { Hst: any }) => {
  const { Hst } = props

  return (
    <Hst.Story title="Color Tokens" group="design-tokens">
      <Hst.Variant title="All Colors">
        <div style={{ display: 'flex', gap: '1.5rem', 'flex-wrap': 'wrap' }}>
          <ThemePanel theme={chronicleTheme} name="Chronicle (Dark)">
            <AllColors />
          </ThemePanel>
          <ThemePanel theme={starlightTheme} name="Starlight (Light)">
            <AllColors />
          </ThemePanel>
        </div>
      </Hst.Variant>
    </Hst.Story>
  )
}
