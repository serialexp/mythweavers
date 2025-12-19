import { ThemeComparison } from '../../story-utils/ThemeComparison'
import { Select } from './Select'

const fruitOptions = [
  { value: 'apple', label: 'Apple' },
  { value: 'banana', label: 'Banana' },
  { value: 'cherry', label: 'Cherry' },
  { value: 'date', label: 'Date' },
]

const countryOptions = [
  { value: 'us', label: 'United States' },
  { value: 'uk', label: 'United Kingdom' },
  { value: 'ca', label: 'Canada' },
  { value: 'au', label: 'Australia', disabled: true },
]

export default (props: { Hst: any }) => {
  const { Hst } = props

  return (
    <Hst.Story title="Select" group="components">
      <Hst.Variant title="Default">
        <ThemeComparison>
          <Select options={fruitOptions} placeholder="Select a fruit..." />
        </ThemeComparison>
      </Hst.Variant>

      <Hst.Variant title="Sizes">
        <ThemeComparison>
          <Select size="sm" options={fruitOptions} placeholder="Small" />
          <Select size="md" options={fruitOptions} placeholder="Medium" />
          <Select size="lg" options={fruitOptions} placeholder="Large" />
        </ThemeComparison>
      </Hst.Variant>

      <Hst.Variant title="With Value">
        <ThemeComparison>
          <Select options={fruitOptions} value="banana" />
        </ThemeComparison>
      </Hst.Variant>

      <Hst.Variant title="With Disabled Option">
        <ThemeComparison>
          <Select options={countryOptions} placeholder="Select a country..." />
        </ThemeComparison>
      </Hst.Variant>

      <Hst.Variant title="Disabled">
        <ThemeComparison>
          <Select options={fruitOptions} disabled placeholder="Disabled" />
          <Select options={fruitOptions} disabled value="cherry" />
        </ThemeComparison>
      </Hst.Variant>

      <Hst.Variant title="Invalid">
        <ThemeComparison>
          <Select options={fruitOptions} aria-invalid="true" placeholder="Invalid select" />
        </ThemeComparison>
      </Hst.Variant>
    </Hst.Story>
  )
}
