import { ThemeComparison } from '../../story-utils/ThemeComparison'
import { Textarea } from './Textarea'

export default (props: { Hst: any }) => {
  const { Hst } = props

  return (
    <Hst.Story title="Textarea" group="components">
      <Hst.Variant title="Default">
        <ThemeComparison>
          <Textarea placeholder="Enter your message..." />
        </ThemeComparison>
      </Hst.Variant>

      <Hst.Variant title="Sizes">
        <ThemeComparison>
          <Textarea size="sm" placeholder="Small textarea" />
          <Textarea size="md" placeholder="Medium textarea" />
          <Textarea size="lg" placeholder="Large textarea" />
        </ThemeComparison>
      </Hst.Variant>

      <Hst.Variant title="With Value">
        <ThemeComparison>
          <Textarea value="This is some example text content that spans multiple lines. It demonstrates how the textarea handles longer content." />
        </ThemeComparison>
      </Hst.Variant>

      <Hst.Variant title="Resize Options">
        <ThemeComparison>
          <Textarea resize="none" placeholder="No resize" />
          <Textarea resize="vertical" placeholder="Vertical resize (default)" />
          <Textarea resize="horizontal" placeholder="Horizontal resize" />
          <Textarea resize="both" placeholder="Both directions" />
        </ThemeComparison>
      </Hst.Variant>

      <Hst.Variant title="Disabled">
        <ThemeComparison>
          <Textarea disabled placeholder="Disabled textarea" />
          <Textarea disabled value="Disabled with value" />
        </ThemeComparison>
      </Hst.Variant>

      <Hst.Variant title="Invalid">
        <ThemeComparison>
          <Textarea aria-invalid="true" value="Invalid textarea content" />
        </ThemeComparison>
      </Hst.Variant>

      <Hst.Variant title="With Rows">
        <ThemeComparison>
          <Textarea rows={3} placeholder="3 rows" />
          <Textarea rows={6} placeholder="6 rows" />
        </ThemeComparison>
      </Hst.Variant>
    </Hst.Story>
  )
}
