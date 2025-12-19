import { ThemeComparison } from '../../story-utils/ThemeComparison'
import { Button } from '../Button'
import { Spinner } from './Spinner'

export default (props: { Hst: any }) => {
  const { Hst } = props

  return (
    <Hst.Story title="Spinner" group="components">
      <Hst.Variant title="Sizes">
        <ThemeComparison>
          <div style={{ display: 'flex', 'align-items': 'center', gap: '1rem' }}>
            <Spinner size="sm" />
            <Spinner size="md" />
            <Spinner size="lg" />
            <Spinner size="xl" />
          </div>
        </ThemeComparison>
      </Hst.Variant>

      <Hst.Variant title="With Text">
        <ThemeComparison>
          <div style={{ display: 'flex', 'align-items': 'center', gap: '0.5rem' }}>
            <Spinner size="sm" />
            <span>Loading...</span>
          </div>
        </ThemeComparison>
      </Hst.Variant>

      <Hst.Variant title="In Button">
        <ThemeComparison>
          <Button disabled>
            <Spinner size="sm" /> Saving...
          </Button>
        </ThemeComparison>
      </Hst.Variant>

      <Hst.Variant title="Centered">
        <ThemeComparison>
          <div style={{ display: 'flex', 'justify-content': 'center', padding: '2rem' }}>
            <Spinner size="lg" label="Loading content" />
          </div>
        </ThemeComparison>
      </Hst.Variant>
    </Hst.Story>
  )
}
