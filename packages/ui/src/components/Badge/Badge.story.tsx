import { ThemeComparison } from '../../story-utils/ThemeComparison'
import { Badge } from './Badge'

const CheckIcon = () => (
  <svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <polyline points="20,6 9,17 4,12" />
  </svg>
)

const AlertIcon = () => (
  <svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="8" x2="12" y2="12" />
    <line x1="12" y1="16" x2="12.01" y2="16" />
  </svg>
)

export default (props: { Hst: any }) => {
  const { Hst } = props

  return (
    <Hst.Story title="Badge" group="components">
      <Hst.Variant title="Variants">
        <ThemeComparison>
          <Badge variant="default">Default</Badge>
          <Badge variant="primary">Primary</Badge>
          <Badge variant="secondary">Secondary</Badge>
          <Badge variant="success">Success</Badge>
          <Badge variant="warning">Warning</Badge>
          <Badge variant="error">Error</Badge>
          <Badge variant="info">Info</Badge>
        </ThemeComparison>
      </Hst.Variant>

      <Hst.Variant title="Sizes">
        <ThemeComparison>
          <Badge size="sm">Small</Badge>
          <Badge size="md">Medium</Badge>
          <Badge size="lg">Large</Badge>
        </ThemeComparison>
      </Hst.Variant>

      <Hst.Variant title="With Icons">
        <ThemeComparison>
          <Badge variant="success" icon={<CheckIcon />}>
            Completed
          </Badge>
          <Badge variant="warning" icon={<AlertIcon />}>
            Pending
          </Badge>
          <Badge variant="error" icon={<AlertIcon />}>
            Failed
          </Badge>
        </ThemeComparison>
      </Hst.Variant>

      <Hst.Variant title="Status Examples">
        <ThemeComparison>
          <Badge variant="success">Active</Badge>
          <Badge variant="secondary">Draft</Badge>
          <Badge variant="warning">Review</Badge>
          <Badge variant="error">Archived</Badge>
          <Badge variant="info">New</Badge>
        </ThemeComparison>
      </Hst.Variant>
    </Hst.Story>
  )
}
