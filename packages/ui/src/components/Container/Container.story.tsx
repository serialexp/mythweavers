import { ThemeComparison } from '../../story-utils/ThemeComparison'
import { Container } from './Container'

const ContentBox = () => (
  <div
    style={{
      padding: '1rem',
      'background-color': 'var(--color-surface-default)',
      border: '1px solid var(--color-border-default)',
      'border-radius': '4px',
      'text-align': 'center',
    }}
  >
    Content inside container
  </div>
)

export default (props: { Hst: any }) => {
  const { Hst } = props

  return (
    <Hst.Story title="Container" group="layout">
      <Hst.Variant title="Default (lg)">
        <ThemeComparison>
          <div style={{ background: 'var(--color-bg-raised)', padding: '1rem' }}>
            <Container>
              <ContentBox />
            </Container>
          </div>
        </ThemeComparison>
      </Hst.Variant>

      <Hst.Variant title="Sizes">
        <ThemeComparison>
          <div style={{ background: 'var(--color-bg-raised)', padding: '1rem' }}>
            <div style={{ 'margin-bottom': '1rem' }}>
              <small>size="sm" (640px)</small>
              <Container size="sm">
                <ContentBox />
              </Container>
            </div>
            <div style={{ 'margin-bottom': '1rem' }}>
              <small>size="md" (768px)</small>
              <Container size="md">
                <ContentBox />
              </Container>
            </div>
            <div style={{ 'margin-bottom': '1rem' }}>
              <small>size="lg" (1024px)</small>
              <Container size="lg">
                <ContentBox />
              </Container>
            </div>
            <div style={{ 'margin-bottom': '1rem' }}>
              <small>size="xl" (1280px)</small>
              <Container size="xl">
                <ContentBox />
              </Container>
            </div>
            <div>
              <small>size="2xl" (1536px)</small>
              <Container size="2xl">
                <ContentBox />
              </Container>
            </div>
          </div>
        </ThemeComparison>
      </Hst.Variant>

      <Hst.Variant title="Padding Options">
        <ThemeComparison>
          <div style={{ background: 'var(--color-bg-raised)' }}>
            <div style={{ 'margin-bottom': '1rem' }}>
              <small>padding="none"</small>
              <Container size="sm" padding="none">
                <ContentBox />
              </Container>
            </div>
            <div style={{ 'margin-bottom': '1rem' }}>
              <small>padding="sm"</small>
              <Container size="sm" padding="sm">
                <ContentBox />
              </Container>
            </div>
            <div style={{ 'margin-bottom': '1rem' }}>
              <small>padding="md"</small>
              <Container size="sm" padding="md">
                <ContentBox />
              </Container>
            </div>
            <div>
              <small>padding="lg"</small>
              <Container size="sm" padding="lg">
                <ContentBox />
              </Container>
            </div>
          </div>
        </ThemeComparison>
      </Hst.Variant>

      <Hst.Variant title="Centered Content">
        <ThemeComparison>
          <div style={{ background: 'var(--color-bg-raised)', padding: '1rem' }}>
            <Container size="md" center>
              <div
                style={{
                  padding: '1rem',
                  'background-color': 'var(--color-surface-default)',
                  border: '1px solid var(--color-border-default)',
                  'border-radius': '4px',
                  width: '200px',
                }}
              >
                Centered block
              </div>
            </Container>
          </div>
        </ThemeComparison>
      </Hst.Variant>
    </Hst.Story>
  )
}
