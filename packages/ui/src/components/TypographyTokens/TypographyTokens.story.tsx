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
      'min-width': '300px',
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
    <div style={{ display: 'flex', 'flex-direction': 'column', gap: '0.75rem' }}>{props.children}</div>
  </div>
)

const FontFamilySample = (props: { name: string; family: string }) => (
  <div style={{ display: 'flex', 'flex-direction': 'column', gap: '4px' }}>
    <span style={{ 'font-size': '12px', opacity: 0.6 }}>{props.name}</span>
    <span style={{ 'font-family': props.family, 'font-size': '18px' }}>
      The quick brown fox jumps over the lazy dog
    </span>
  </div>
)

const FontSizeSample = (props: { name: string; size: string }) => (
  <div style={{ display: 'flex', 'align-items': 'baseline', gap: '1rem' }}>
    <span style={{ 'font-size': '12px', opacity: 0.6, 'min-width': '60px' }}>{props.name}</span>
    <span style={{ 'font-size': props.size }}>Aa</span>
    <span style={{ 'font-size': '12px', opacity: 0.5 }}>{props.size}</span>
  </div>
)

const FontWeightSample = (props: { name: string; weight: string }) => (
  <div style={{ display: 'flex', 'align-items': 'baseline', gap: '1rem' }}>
    <span style={{ 'font-size': '12px', opacity: 0.6, 'min-width': '80px' }}>{props.name}</span>
    <span style={{ 'font-weight': props.weight, 'font-size': '16px' }}>The quick brown fox</span>
  </div>
)

const LineHeightSample = (props: { name: string; lineHeight: string }) => (
  <div style={{ display: 'flex', gap: '1rem' }}>
    <span style={{ 'font-size': '12px', opacity: 0.6, 'min-width': '60px' }}>{props.name}</span>
    <p
      style={{
        'line-height': props.lineHeight,
        'font-size': '14px',
        margin: 0,
        'max-width': '200px',
        'background-color': tokens.color.surface.default,
        padding: '4px',
        'border-radius': '4px',
      }}
    >
      Line height {props.lineHeight}. This text demonstrates the spacing between lines.
    </p>
  </div>
)

const LetterSpacingSample = (props: { name: string; spacing: string }) => (
  <div style={{ display: 'flex', 'align-items': 'baseline', gap: '1rem' }}>
    <span style={{ 'font-size': '12px', opacity: 0.6, 'min-width': '60px' }}>{props.name}</span>
    <span style={{ 'letter-spacing': props.spacing, 'font-size': '14px', 'text-transform': 'uppercase' }}>
      Letter Spacing
    </span>
  </div>
)

const AllTypography = () => (
  <>
    <TokenGroup title="Font Family">
      <FontFamilySample name="sans" family={tokens.font.family.sans} />
      <FontFamilySample name="serif" family={tokens.font.family.serif} />
      <FontFamilySample name="mono" family={tokens.font.family.mono} />
    </TokenGroup>

    <TokenGroup title="Font Size">
      <FontSizeSample name="xs" size={tokens.font.size.xs} />
      <FontSizeSample name="sm" size={tokens.font.size.sm} />
      <FontSizeSample name="base" size={tokens.font.size.base} />
      <FontSizeSample name="lg" size={tokens.font.size.lg} />
      <FontSizeSample name="xl" size={tokens.font.size.xl} />
      <FontSizeSample name="2xl" size={tokens.font.size['2xl']} />
      <FontSizeSample name="3xl" size={tokens.font.size['3xl']} />
      <FontSizeSample name="4xl" size={tokens.font.size['4xl']} />
    </TokenGroup>

    <TokenGroup title="Font Weight">
      <FontWeightSample name="normal" weight={tokens.font.weight.normal} />
      <FontWeightSample name="medium" weight={tokens.font.weight.medium} />
      <FontWeightSample name="semibold" weight={tokens.font.weight.semibold} />
      <FontWeightSample name="bold" weight={tokens.font.weight.bold} />
    </TokenGroup>

    <TokenGroup title="Line Height">
      <LineHeightSample name="tight" lineHeight={tokens.font.lineHeight.tight} />
      <LineHeightSample name="normal" lineHeight={tokens.font.lineHeight.normal} />
      <LineHeightSample name="relaxed" lineHeight={tokens.font.lineHeight.relaxed} />
    </TokenGroup>

    <TokenGroup title="Letter Spacing">
      <LetterSpacingSample name="tight" spacing={tokens.font.letterSpacing.tight} />
      <LetterSpacingSample name="normal" spacing={tokens.font.letterSpacing.normal} />
      <LetterSpacingSample name="wide" spacing={tokens.font.letterSpacing.wide} />
    </TokenGroup>
  </>
)

export default (props: { Hst: any }) => {
  const { Hst } = props

  return (
    <Hst.Story title="Typography Tokens" group="design-tokens">
      <Hst.Variant title="All Typography">
        <div style={{ display: 'flex', gap: '1.5rem', 'flex-wrap': 'wrap' }}>
          <ThemePanel theme={chronicleTheme} name="Chronicle (Dark)">
            <AllTypography />
          </ThemePanel>
          <ThemePanel theme={starlightTheme} name="Starlight (Light)">
            <AllTypography />
          </ThemePanel>
        </div>
      </Hst.Variant>
    </Hst.Story>
  )
}
