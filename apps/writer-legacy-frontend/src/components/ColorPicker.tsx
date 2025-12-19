import { For } from 'solid-js'

export const HAIR_COLORS = [
  { name: 'Black', value: '#000000' },
  { name: 'Dark Brown', value: '#3B271D' },
  { name: 'Brown', value: '#694731' },
  { name: 'Light Brown', value: '#9E6B4C' },
  { name: 'Blonde', value: '#E6BE8A' },
  { name: 'Light Blonde', value: '#F2D5A8' },
  { name: 'Red', value: '#8C3B27' },
  { name: 'Auburn', value: '#922B05' },
  { name: 'Grey', value: '#999999' },
  { name: 'White', value: '#FFFFFF' },
  { name: 'Silver', value: '#C0C0C0' },
  { name: 'Platinum', value: '#E5E4E2' },
  { name: 'Ginger', value: '#D44500' },
  { name: 'Strawberry Blonde', value: '#E6A57E' },
] as const

export const EYE_COLORS = [
  { name: 'Brown', value: '#694731' },
  { name: 'Blue', value: '#0066CC' },
  { name: 'Green', value: '#006633' },
  { name: 'Hazel', value: '#9E6B4C' },
  { name: 'Grey', value: '#999999' },
  { name: 'Amber', value: '#FFA000' },
] as const

const COLOR_VALUE_MAP = new Map([...HAIR_COLORS, ...EYE_COLORS].map((color) => [color.name, color.value]))

export const ColorPicker = (props: {
  value: string
  onChange: (color: string) => void
  colors?: typeof HAIR_COLORS | typeof EYE_COLORS
}) => {
  const colors = props.colors ?? HAIR_COLORS

  return (
    <div class="flex flex-wrap gap-2">
      <For each={colors}>
        {(color) => (
          <button
            type="button"
            class="w-8 h-8 rounded border-2 transition-all"
            style={{
              'background-color': color.value,
              'border-color': props.value === color.name ? '#fff' : 'transparent',
              outline: props.value === color.name ? '1px solid #888' : 'none',
            }}
            title={color.name}
            onClick={() => props.onChange(color.name)}
          />
        )}
      </For>
    </div>
  )
}

// Helper function to get the actual color value from a color name
export const getColorValue = (colorName: string) => {
  return COLOR_VALUE_MAP.get(colorName) ?? colorName
}
