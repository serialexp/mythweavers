import { ThemeComparison } from '../../story-utils/ThemeComparison'
import { Input } from './Input'

export default (props: { Hst: any }) => {
  const { Hst } = props

  return (
    <Hst.Story title="Input" group="components">
      <Hst.Variant title="Default">
        <ThemeComparison>
          <Input placeholder="Enter text..." />
        </ThemeComparison>
      </Hst.Variant>

      <Hst.Variant title="Sizes">
        <ThemeComparison>
          <Input size="sm" placeholder="Small input" />
          <Input size="md" placeholder="Medium input" />
          <Input size="lg" placeholder="Large input" />
        </ThemeComparison>
      </Hst.Variant>

      <Hst.Variant title="With Value">
        <ThemeComparison>
          <Input value="Hello, World!" />
        </ThemeComparison>
      </Hst.Variant>

      <Hst.Variant title="Types">
        <ThemeComparison>
          <Input type="text" placeholder="Text input" />
          <Input type="email" placeholder="Email input" />
          <Input type="password" placeholder="Password input" />
          <Input type="number" placeholder="Number input" />
        </ThemeComparison>
      </Hst.Variant>

      <Hst.Variant title="Disabled">
        <ThemeComparison>
          <Input disabled placeholder="Disabled input" />
          <Input disabled value="Disabled with value" />
        </ThemeComparison>
      </Hst.Variant>

      <Hst.Variant title="Invalid">
        <ThemeComparison>
          <Input aria-invalid="true" value="Invalid input" />
        </ThemeComparison>
      </Hst.Variant>
    </Hst.Story>
  )
}
