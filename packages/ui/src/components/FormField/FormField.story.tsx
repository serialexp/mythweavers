import { ThemeComparison } from '../../story-utils/ThemeComparison'
import { Input } from '../Input'
import { Select } from '../Select'
import { Textarea } from '../Textarea'
import { FormField } from './FormField'

const countryOptions = [
  { value: 'us', label: 'United States' },
  { value: 'uk', label: 'United Kingdom' },
  { value: 'ca', label: 'Canada' },
]

export default (props: { Hst: any }) => {
  const { Hst } = props

  return (
    <Hst.Story title="FormField" group="components">
      <Hst.Variant title="Basic">
        <ThemeComparison>
          <FormField label="Email">
            <Input type="email" placeholder="you@example.com" />
          </FormField>
        </ThemeComparison>
      </Hst.Variant>

      <Hst.Variant title="Required">
        <ThemeComparison>
          <FormField label="Username" required>
            <Input placeholder="Enter username" />
          </FormField>
        </ThemeComparison>
      </Hst.Variant>

      <Hst.Variant title="Optional">
        <ThemeComparison>
          <FormField label="Nickname" showOptional>
            <Input placeholder="Enter nickname" />
          </FormField>
        </ThemeComparison>
      </Hst.Variant>

      <Hst.Variant title="With Help Text">
        <ThemeComparison>
          <FormField label="Password" helpText="Must be at least 8 characters">
            <Input type="password" placeholder="Enter password" />
          </FormField>
        </ThemeComparison>
      </Hst.Variant>

      <Hst.Variant title="With Error">
        <ThemeComparison>
          <FormField label="Email" error="Please enter a valid email address">
            <Input type="email" value="invalid-email" aria-invalid="true" />
          </FormField>
        </ThemeComparison>
      </Hst.Variant>

      <Hst.Variant title="With Textarea">
        <ThemeComparison>
          <FormField label="Bio" helpText="Tell us about yourself">
            <Textarea placeholder="Write a short bio..." rows={3} />
          </FormField>
        </ThemeComparison>
      </Hst.Variant>

      <Hst.Variant title="With Select">
        <ThemeComparison>
          <FormField label="Country" required>
            <Select options={countryOptions} placeholder="Select a country..." />
          </FormField>
        </ThemeComparison>
      </Hst.Variant>

      <Hst.Variant title="Form Example">
        <ThemeComparison>
          <form style={{ display: 'flex', 'flex-direction': 'column', gap: '1rem' }}>
            <FormField label="Name" required>
              <Input placeholder="John Doe" />
            </FormField>
            <FormField label="Email" required error="Email is required">
              <Input type="email" aria-invalid="true" />
            </FormField>
            <FormField label="Country">
              <Select options={countryOptions} placeholder="Select..." />
            </FormField>
            <FormField label="Message" showOptional>
              <Textarea placeholder="Your message..." rows={3} />
            </FormField>
          </form>
        </ThemeComparison>
      </Hst.Variant>
    </Hst.Story>
  )
}
