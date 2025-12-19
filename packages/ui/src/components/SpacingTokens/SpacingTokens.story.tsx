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

const SpacingSample = (props: { name: string; size: string }) => (
  <div style={{ display: 'flex', 'align-items': 'center', gap: '1rem', 'margin-bottom': '0.5rem' }}>
    <span style={{ 'font-size': '12px', opacity: 0.6, 'min-width': '40px', 'font-family': 'monospace' }}>
      {props.name}
    </span>
    <div
      style={{
        width: props.size,
        height: '24px',
        'background-color': tokens.color.accent.primary,
        'border-radius': '2px',
      }}
    />
    <span style={{ 'font-size': '12px', opacity: 0.5 }}>{props.size}</span>
  </div>
)

const AllSpacing = () => (
  <div style={{ display: 'flex', 'flex-direction': 'column' }}>
    <SpacingSample name="px" size={tokens.space.px} />
    <SpacingSample name="0.5" size={tokens.space['0.5']} />
    <SpacingSample name="1" size={tokens.space['1']} />
    <SpacingSample name="1.5" size={tokens.space['1.5']} />
    <SpacingSample name="2" size={tokens.space['2']} />
    <SpacingSample name="2.5" size={tokens.space['2.5']} />
    <SpacingSample name="3" size={tokens.space['3']} />
    <SpacingSample name="4" size={tokens.space['4']} />
    <SpacingSample name="5" size={tokens.space['5']} />
    <SpacingSample name="6" size={tokens.space['6']} />
    <SpacingSample name="8" size={tokens.space['8']} />
    <SpacingSample name="10" size={tokens.space['10']} />
    <SpacingSample name="12" size={tokens.space['12']} />
    <SpacingSample name="16" size={tokens.space['16']} />
    <SpacingSample name="20" size={tokens.space['20']} />
    <SpacingSample name="24" size={tokens.space['24']} />
  </div>
)

export default (props: { Hst: any }) => {
  const { Hst } = props

  return (
    <Hst.Story title="Spacing Tokens" group="design-tokens">
      <Hst.Variant title="All Spacing">
        <div style={{ display: 'flex', gap: '1.5rem', 'flex-wrap': 'wrap' }}>
          <ThemePanel theme={chronicleTheme} name="Chronicle (Dark)">
            <AllSpacing />
          </ThemePanel>
          <ThemePanel theme={starlightTheme} name="Starlight (Light)">
            <AllSpacing />
          </ThemePanel>
        </div>
      </Hst.Variant>
    </Hst.Story>
  )
}
