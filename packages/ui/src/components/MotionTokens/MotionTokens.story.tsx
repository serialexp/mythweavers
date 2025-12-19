import { type ParentComponent, createSignal, onCleanup } from 'solid-js'
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
    <div style={{ display: 'flex', 'flex-direction': 'column', gap: '0.75rem' }}>{props.children}</div>
  </div>
)

const DurationSample = (props: { name: string; duration: string }) => {
  const [active, setActive] = createSignal(false)

  // Auto-animate every 2 seconds
  const interval = setInterval(() => setActive((a) => !a), 2000)
  onCleanup(() => clearInterval(interval))

  return (
    <div style={{ display: 'flex', 'align-items': 'center', gap: '1rem' }}>
      <span style={{ 'font-size': '12px', opacity: 0.6, 'min-width': '60px' }}>{props.name}</span>
      <div
        style={{
          width: '40px',
          height: '40px',
          'background-color': active() ? tokens.color.accent.primary : tokens.color.surface.default,
          'border-radius': tokens.radius.default,
          transition: `background-color ${props.duration} ${tokens.easing.default}`,
        }}
      />
      <span style={{ 'font-size': '12px', opacity: 0.5 }}>{props.duration}</span>
    </div>
  )
}

const EasingSample = (props: { name: string; easing: string }) => {
  const [active, setActive] = createSignal(false)

  // Auto-animate every 2 seconds
  const interval = setInterval(() => setActive((a) => !a), 2000)
  onCleanup(() => clearInterval(interval))

  return (
    <div style={{ display: 'flex', 'align-items': 'center', gap: '1rem' }}>
      <span style={{ 'font-size': '12px', opacity: 0.6, 'min-width': '60px' }}>{props.name}</span>
      <div
        style={{
          width: '150px',
          height: '40px',
          position: 'relative',
          'background-color': tokens.color.surface.default,
          'border-radius': tokens.radius.default,
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: '4px',
            left: active() ? '110px' : '4px',
            width: '32px',
            height: '32px',
            'background-color': tokens.color.accent.primary,
            'border-radius': tokens.radius.default,
            transition: `left ${tokens.duration.slow} ${props.easing}`,
          }}
        />
      </div>
    </div>
  )
}

const AllMotion = () => (
  <>
    <TokenGroup title="Duration">
      <DurationSample name="instant" duration={tokens.duration.instant} />
      <DurationSample name="fast" duration={tokens.duration.fast} />
      <DurationSample name="normal" duration={tokens.duration.normal} />
      <DurationSample name="slow" duration={tokens.duration.slow} />
      <DurationSample name="slower" duration={tokens.duration.slower} />
    </TokenGroup>

    <TokenGroup title="Easing">
      <EasingSample name="default" easing={tokens.easing.default} />
      <EasingSample name="in" easing={tokens.easing.in} />
      <EasingSample name="out" easing={tokens.easing.out} />
      <EasingSample name="inOut" easing={tokens.easing.inOut} />
      <EasingSample name="bounce" easing={tokens.easing.bounce} />
    </TokenGroup>
  </>
)

export default (props: { Hst: any }) => {
  const { Hst } = props

  return (
    <Hst.Story title="Motion Tokens" group="design-tokens">
      <Hst.Variant title="All Motion">
        <div style={{ display: 'flex', gap: '1.5rem', 'flex-wrap': 'wrap' }}>
          <ThemePanel theme={chronicleTheme} name="Chronicle (Dark)">
            <AllMotion />
          </ThemePanel>
          <ThemePanel theme={starlightTheme} name="Starlight (Light)">
            <AllMotion />
          </ThemePanel>
        </div>
      </Hst.Variant>
    </Hst.Story>
  )
}
