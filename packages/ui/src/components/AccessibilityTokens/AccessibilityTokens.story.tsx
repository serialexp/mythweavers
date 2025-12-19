import { colord, extend } from 'colord'
import a11yPlugin from 'colord/plugins/a11y'
import type { ParentComponent } from 'solid-js'
import { chronicleColors } from '../../theme/chronicle.colors'
import { chronicleTheme } from '../../theme/chronicle.css'
import { starlightColors } from '../../theme/starlight.colors'
import { starlightTheme } from '../../theme/starlight.css'
import { tokens } from '../../theme/tokens.css'

extend([a11yPlugin])

// Calculate contrast ratio using colord
function getContrastRatio(color1: string, color2: string): number {
  return colord(color1).contrast(color2)
}

// WCAG ratings
function getWCAGRating(ratio: number): { aa: boolean; aaLarge: boolean; aaa: boolean; aaaLarge: boolean } {
  return {
    aa: ratio >= 4.5,
    aaLarge: ratio >= 3,
    aaa: ratio >= 7,
    aaaLarge: ratio >= 4.5,
  }
}

type ColorValues = typeof chronicleColors

const Badge = (props: { pass: boolean; label: string }) => (
  <span
    style={{
      padding: '2px 6px',
      'border-radius': '4px',
      'font-size': '11px',
      'font-weight': '600',
      'background-color': props.pass ? 'rgba(74, 124, 89, 0.3)' : 'rgba(166, 61, 64, 0.3)',
      color: props.pass ? '#6ab07a' : '#d46a6a',
    }}
  >
    {props.label}
  </span>
)

const ContrastRow = (props: {
  textName: string
  textColor: string
  bgName: string
  bgColor: string
}) => {
  const ratio = getContrastRatio(props.textColor, props.bgColor)
  const rating = getWCAGRating(ratio)

  return (
    <div
      style={{
        display: 'flex',
        'align-items': 'center',
        gap: '1rem',
        padding: '0.75rem',
        'background-color': props.bgColor,
        'border-radius': '6px',
        'margin-bottom': '0.5rem',
      }}
    >
      <span style={{ color: props.textColor, 'min-width': '120px', 'font-size': '14px' }}>Sample Text</span>
      <span style={{ color: props.textColor, 'font-size': '12px', opacity: 0.8, flex: 1 }}>
        {props.textName} on {props.bgName}
      </span>
      <span style={{ color: props.textColor, 'font-size': '13px', 'font-weight': '600', 'min-width': '50px' }}>
        {ratio.toFixed(2)}:1
      </span>
      <div style={{ display: 'flex', gap: '4px' }}>
        <Badge pass={rating.aaLarge} label="AA+" />
        <Badge pass={rating.aa} label="AA" />
        <Badge pass={rating.aaa} label="AAA" />
      </div>
    </div>
  )
}

const ThemePanel: ParentComponent<{ theme: string; name: string }> = (props) => (
  <div
    class={props.theme}
    style={{
      padding: '1.5rem',
      'background-color': tokens.color.bg.base,
      color: tokens.color.text.primary,
      'border-radius': '8px',
      'min-width': '500px',
    }}
  >
    <h2 style={{ margin: '0 0 1rem 0', 'font-size': '18px', 'font-weight': '600' }}>{props.name}</h2>
    <p style={{ margin: '0 0 1.5rem 0', 'font-size': '12px', opacity: 0.7 }}>
      AA+ = Large text (3:1) | AA = Normal text (4.5:1) | AAA = Enhanced (7:1)
    </p>
    {props.children}
  </div>
)

const TokenGroup = (props: { title: string; children: any }) => (
  <div style={{ 'margin-bottom': '1.5rem' }}>
    <h3
      style={{
        margin: '0 0 0.75rem 0',
        'font-size': '13px',
        'font-weight': '600',
        'text-transform': 'uppercase',
        'letter-spacing': '0.05em',
        opacity: 0.7,
      }}
    >
      {props.title}
    </h3>
    {props.children}
  </div>
)

const AllContrasts = (props: { colors: ColorValues }) => (
  <>
    <TokenGroup title="Text on Base Background">
      <ContrastRow
        textName="text.primary"
        textColor={props.colors.text.primary}
        bgName="bg.base"
        bgColor={props.colors.bg.base}
      />
      <ContrastRow
        textName="text.secondary"
        textColor={props.colors.text.secondary}
        bgName="bg.base"
        bgColor={props.colors.bg.base}
      />
      <ContrastRow
        textName="text.muted"
        textColor={props.colors.text.muted}
        bgName="bg.base"
        bgColor={props.colors.bg.base}
      />
    </TokenGroup>

    <TokenGroup title="Text on Raised Background">
      <ContrastRow
        textName="text.primary"
        textColor={props.colors.text.primary}
        bgName="bg.raised"
        bgColor={props.colors.bg.raised}
      />
      <ContrastRow
        textName="text.secondary"
        textColor={props.colors.text.secondary}
        bgName="bg.raised"
        bgColor={props.colors.bg.raised}
      />
      <ContrastRow
        textName="text.muted"
        textColor={props.colors.text.muted}
        bgName="bg.raised"
        bgColor={props.colors.bg.raised}
      />
    </TokenGroup>

    <TokenGroup title="Text on Surface">
      <ContrastRow
        textName="text.primary"
        textColor={props.colors.text.primary}
        bgName="surface.default"
        bgColor={props.colors.surface.default}
      />
      <ContrastRow
        textName="text.secondary"
        textColor={props.colors.text.secondary}
        bgName="surface.default"
        bgColor={props.colors.surface.default}
      />
    </TokenGroup>

    <TokenGroup title="Accent Colors">
      <ContrastRow
        textName="text.inverse"
        textColor={props.colors.text.inverse}
        bgName="accent.primary"
        bgColor={props.colors.accent.primary}
      />
      <ContrastRow
        textName="text.inverse"
        textColor={props.colors.text.inverse}
        bgName="accent.secondary"
        bgColor={props.colors.accent.secondary}
      />
    </TokenGroup>

    <TokenGroup title="Semantic Colors">
      <ContrastRow
        textName="text.primary"
        textColor={props.colors.text.primary}
        bgName="semantic.successSubtle"
        bgColor={props.colors.semantic.successSubtle}
      />
      <ContrastRow
        textName="text.primary"
        textColor={props.colors.text.primary}
        bgName="semantic.errorSubtle"
        bgColor={props.colors.semantic.errorSubtle}
      />
      <ContrastRow
        textName="text.primary"
        textColor={props.colors.text.primary}
        bgName="semantic.warningSubtle"
        bgColor={props.colors.semantic.warningSubtle}
      />
      <ContrastRow
        textName="text.primary"
        textColor={props.colors.text.primary}
        bgName="semantic.infoSubtle"
        bgColor={props.colors.semantic.infoSubtle}
      />
    </TokenGroup>
  </>
)

export default (props: { Hst: any }) => {
  const { Hst } = props

  return (
    <Hst.Story title="Accessibility" group="design-tokens">
      <Hst.Variant title="Contrast Ratios">
        <div style={{ display: 'flex', gap: '1.5rem', 'flex-wrap': 'wrap' }}>
          <ThemePanel theme={chronicleTheme} name="Chronicle (Dark)">
            <AllContrasts colors={chronicleColors} />
          </ThemePanel>
          <ThemePanel theme={starlightTheme} name="Starlight (Light)">
            <AllContrasts colors={starlightColors} />
          </ThemePanel>
        </div>
      </Hst.Variant>
    </Hst.Story>
  )
}
