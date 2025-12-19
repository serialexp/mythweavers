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

const TokenGroup = (props: { title: string; children: any }) => (
  <div style={{ 'margin-bottom': '2rem' }}>
    <h3
      style={{
        margin: '0 0 1rem 0',
        'font-size': '14px',
        'font-weight': '600',
        'text-transform': 'uppercase',
        'letter-spacing': '0.05em',
        opacity: 0.7,
      }}
    >
      {props.title}
    </h3>
    <div style={{ display: 'flex', 'flex-wrap': 'wrap', gap: '1rem' }}>{props.children}</div>
  </div>
)

const RadiusSample = (props: { name: string; radius: string }) => (
  <div style={{ display: 'flex', 'flex-direction': 'column', 'align-items': 'center', gap: '0.5rem' }}>
    <div
      style={{
        width: '64px',
        height: '64px',
        'background-color': tokens.color.surface.default,
        border: `2px solid ${tokens.color.border.default}`,
        'border-radius': props.radius,
      }}
    />
    <span style={{ 'font-size': '12px', opacity: 0.6 }}>{props.name}</span>
    <span style={{ 'font-size': '11px', opacity: 0.4 }}>{props.radius}</span>
  </div>
)

const BorderWidthSample = (props: { name: string; width: string }) => (
  <div style={{ display: 'flex', 'flex-direction': 'column', 'align-items': 'center', gap: '0.5rem' }}>
    <div
      style={{
        width: '64px',
        height: '64px',
        'background-color': tokens.color.surface.default,
        border: `${props.width} solid ${tokens.color.border.strong}`,
        'border-radius': tokens.radius.default,
      }}
    />
    <span style={{ 'font-size': '12px', opacity: 0.6 }}>{props.name}</span>
    <span style={{ 'font-size': '11px', opacity: 0.4 }}>{props.width}</span>
  </div>
)

const AllBorders = () => (
  <>
    <TokenGroup title="Border Radius">
      <RadiusSample name="none" radius={tokens.radius.none} />
      <RadiusSample name="sm" radius={tokens.radius.sm} />
      <RadiusSample name="default" radius={tokens.radius.default} />
      <RadiusSample name="md" radius={tokens.radius.md} />
      <RadiusSample name="lg" radius={tokens.radius.lg} />
      <RadiusSample name="xl" radius={tokens.radius.xl} />
      <RadiusSample name="2xl" radius={tokens.radius['2xl']} />
      <RadiusSample name="full" radius={tokens.radius.full} />
    </TokenGroup>

    <TokenGroup title="Border Width">
      <BorderWidthSample name="thin" width={tokens.borderWidth.thin} />
      <BorderWidthSample name="default" width={tokens.borderWidth.default} />
      <BorderWidthSample name="thick" width={tokens.borderWidth.thick} />
    </TokenGroup>
  </>
)

export default (props: { Hst: any }) => {
  const { Hst } = props

  return (
    <Hst.Story title="Border Tokens" group="design-tokens">
      <Hst.Variant title="All Borders">
        <div style={{ display: 'flex', gap: '1.5rem', 'flex-wrap': 'wrap' }}>
          <ThemePanel theme={chronicleTheme} name="Chronicle (Dark)">
            <AllBorders />
          </ThemePanel>
          <ThemePanel theme={starlightTheme} name="Starlight (Light)">
            <AllBorders />
          </ThemePanel>
        </div>
      </Hst.Variant>
    </Hst.Story>
  )
}
