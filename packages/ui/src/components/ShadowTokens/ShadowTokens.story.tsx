import type { ParentComponent } from 'solid-js'
import { chronicleTheme } from '../../theme/chronicle.css'
import { starlightTheme } from '../../theme/starlight.css'
import { tokens } from '../../theme/tokens.css'

const ThemePanel: ParentComponent<{ theme: string; name: string }> = (props) => (
  <div
    class={props.theme}
    style={{
      padding: '1.5rem',
      'background-color': tokens.color.bg.base,
      color: tokens.color.text.primary,
      'border-radius': '8px',
    }}
  >
    <h2 style={{ margin: '0 0 1.5rem 0', 'font-size': '18px', 'font-weight': '600' }}>{props.name}</h2>
    {props.children}
  </div>
)

const ShadowSample = (props: { name: string; shadow: string }) => (
  <div style={{ display: 'flex', 'flex-direction': 'column', 'align-items': 'center', gap: '0.75rem' }}>
    <div
      style={{
        width: '80px',
        height: '80px',
        'background-color': tokens.color.bg.raised,
        'border-radius': tokens.radius.lg,
        'box-shadow': props.shadow,
      }}
    />
    <span style={{ 'font-size': '12px', opacity: 0.6 }}>{props.name}</span>
  </div>
)

const AllShadows = () => (
  <div style={{ display: 'flex', 'flex-wrap': 'wrap', gap: '2rem' }}>
    <ShadowSample name="none" shadow={tokens.shadow.none} />
    <ShadowSample name="sm" shadow={tokens.shadow.sm} />
    <ShadowSample name="default" shadow={tokens.shadow.default} />
    <ShadowSample name="md" shadow={tokens.shadow.md} />
    <ShadowSample name="lg" shadow={tokens.shadow.lg} />
    <ShadowSample name="xl" shadow={tokens.shadow.xl} />
    <ShadowSample name="inner" shadow={tokens.shadow.inner} />
    <ShadowSample name="glow" shadow={tokens.shadow.glow} />
  </div>
)

export default (props: { Hst: any }) => {
  const { Hst } = props

  return (
    <Hst.Story title="Shadow Tokens" group="design-tokens">
      <Hst.Variant title="All Shadows">
        <div style={{ display: 'flex', gap: '1.5rem', 'flex-wrap': 'wrap' }}>
          <ThemePanel theme={chronicleTheme} name="Chronicle (Dark)">
            <AllShadows />
          </ThemePanel>
          <ThemePanel theme={starlightTheme} name="Starlight (Light)">
            <AllShadows />
          </ThemePanel>
        </div>
      </Hst.Variant>
    </Hst.Story>
  )
}
