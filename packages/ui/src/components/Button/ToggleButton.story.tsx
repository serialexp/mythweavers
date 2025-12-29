import { createSignal } from 'solid-js'
import { ThemeComparison } from '../../story-utils/ThemeComparison'
import { ToggleButton } from './ToggleButton'

// Simple icon components for demo
const BoldIcon = () => (
  <svg width="1em" height="1em" viewBox="0 0 24 24" fill="currentColor">
    <path d="M15.6 10.79c.97-.67 1.65-1.77 1.65-2.79 0-2.26-1.75-4-4-4H7v14h7.04c2.09 0 3.71-1.7 3.71-3.79 0-1.52-.86-2.82-2.15-3.42zM10 6.5h3c.83 0 1.5.67 1.5 1.5s-.67 1.5-1.5 1.5h-3v-3zm3.5 9H10v-3h3.5c.83 0 1.5.67 1.5 1.5s-.67 1.5-1.5 1.5z" />
  </svg>
)

const ItalicIcon = () => (
  <svg width="1em" height="1em" viewBox="0 0 24 24" fill="currentColor">
    <path d="M10 4v3h2.21l-3.42 8H6v3h8v-3h-2.21l3.42-8H18V4z" />
  </svg>
)

const UnderlineIcon = () => (
  <svg width="1em" height="1em" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 17c3.31 0 6-2.69 6-6V3h-2.5v8c0 1.93-1.57 3.5-3.5 3.5S8.5 12.93 8.5 11V3H6v8c0 3.31 2.69 6 6 6zm-7 2v2h14v-2H5z" />
  </svg>
)

const AlignLeftIcon = () => (
  <svg width="1em" height="1em" viewBox="0 0 24 24" fill="currentColor">
    <path d="M15 15H3v2h12v-2zm0-8H3v2h12V7zM3 13h18v-2H3v2zm0 8h18v-2H3v2zM3 3v2h18V3H3z" />
  </svg>
)

const AlignCenterIcon = () => (
  <svg width="1em" height="1em" viewBox="0 0 24 24" fill="currentColor">
    <path d="M7 15v2h10v-2H7zm-4 6h18v-2H3v2zm0-8h18v-2H3v2zm4-6v2h10V7H7zM3 3v2h18V3H3z" />
  </svg>
)

const AlignRightIcon = () => (
  <svg width="1em" height="1em" viewBox="0 0 24 24" fill="currentColor">
    <path d="M3 21h18v-2H3v2zm6-4h12v-2H9v2zm-6-4h18v-2H3v2zm6-4h12V7H9v2zM3 3v2h18V3H3z" />
  </svg>
)

const GridIcon = () => (
  <svg width="1em" height="1em" viewBox="0 0 24 24" fill="currentColor">
    <path d="M3 3v8h8V3H3zm6 6H5V5h4v4zm-6 4v8h8v-8H3zm6 6H5v-4h4v4zm4-16v8h8V3h-8zm6 6h-4V5h4v4zm-6 4v8h8v-8h-8zm6 6h-4v-4h4v4z" />
  </svg>
)

const ListIcon = () => (
  <svg width="1em" height="1em" viewBox="0 0 24 24" fill="currentColor">
    <path d="M3 13h2v-2H3v2zm0 4h2v-2H3v2zm0-8h2V7H3v2zm4 4h14v-2H7v2zm0 4h14v-2H7v2zM7 7v2h14V7H7z" />
  </svg>
)

export default (props: { Hst: any }) => {
  const { Hst } = props

  // State for interactive demos
  const [isBold, setIsBold] = createSignal(false)
  const [isItalic, setIsItalic] = createSignal(true)
  const [isUnderline, setIsUnderline] = createSignal(false)
  const [alignment, setAlignment] = createSignal<'left' | 'center' | 'right'>('left')
  const [viewMode, setViewMode] = createSignal<'grid' | 'list'>('grid')

  return (
    <Hst.Story title="ToggleButton" group="components">
      <Hst.Variant title="Active vs Inactive">
        <ThemeComparison>
          <ToggleButton active={false}>Inactive</ToggleButton>
          <ToggleButton active={true}>Active</ToggleButton>
        </ThemeComparison>
      </Hst.Variant>

      <Hst.Variant title="Sizes">
        <ThemeComparison>
          <ToggleButton size="xs" active>
            Extra Small
          </ToggleButton>
          <ToggleButton size="sm" active>
            Small
          </ToggleButton>
          <ToggleButton size="md" active>
            Medium
          </ToggleButton>
          <ToggleButton size="lg" active>
            Large
          </ToggleButton>
        </ThemeComparison>
      </Hst.Variant>

      <Hst.Variant title="Icon Only">
        <ThemeComparison>
          <ToggleButton iconOnly size="sm" active={false} aria-label="Bold">
            <BoldIcon />
          </ToggleButton>
          <ToggleButton iconOnly size="sm" active={true} aria-label="Italic">
            <ItalicIcon />
          </ToggleButton>
          <ToggleButton iconOnly size="sm" active={false} aria-label="Underline">
            <UnderlineIcon />
          </ToggleButton>
        </ThemeComparison>
      </Hst.Variant>

      <Hst.Variant title="Icon Only (All Sizes)">
        <ThemeComparison>
          <ToggleButton iconOnly size="xs" active aria-label="Extra Small">
            <BoldIcon />
          </ToggleButton>
          <ToggleButton iconOnly size="sm" active aria-label="Small">
            <BoldIcon />
          </ToggleButton>
          <ToggleButton iconOnly size="md" active aria-label="Medium">
            <BoldIcon />
          </ToggleButton>
          <ToggleButton iconOnly size="lg" active aria-label="Large">
            <BoldIcon />
          </ToggleButton>
        </ThemeComparison>
      </Hst.Variant>

      <Hst.Variant title="With Text and Icon">
        <ThemeComparison>
          <ToggleButton size="sm" active={false}>
            <GridIcon /> Grid View
          </ToggleButton>
          <ToggleButton size="sm" active={true}>
            <ListIcon /> List View
          </ToggleButton>
        </ThemeComparison>
      </Hst.Variant>

      <Hst.Variant title="Interactive: Text Formatting">
        <ThemeComparison>
          <div style={{ display: 'flex', gap: '4px' }}>
            <ToggleButton
              iconOnly
              size="sm"
              active={isBold()}
              onClick={() => setIsBold(!isBold())}
              aria-label="Bold"
            >
              <BoldIcon />
            </ToggleButton>
            <ToggleButton
              iconOnly
              size="sm"
              active={isItalic()}
              onClick={() => setIsItalic(!isItalic())}
              aria-label="Italic"
            >
              <ItalicIcon />
            </ToggleButton>
            <ToggleButton
              iconOnly
              size="sm"
              active={isUnderline()}
              onClick={() => setIsUnderline(!isUnderline())}
              aria-label="Underline"
            >
              <UnderlineIcon />
            </ToggleButton>
          </div>
        </ThemeComparison>
      </Hst.Variant>

      <Hst.Variant title="Interactive: Exclusive Selection (Radio-like)">
        <ThemeComparison>
          <div style={{ display: 'flex', gap: '4px' }}>
            <ToggleButton
              iconOnly
              size="sm"
              active={alignment() === 'left'}
              onClick={() => setAlignment('left')}
              aria-label="Align Left"
            >
              <AlignLeftIcon />
            </ToggleButton>
            <ToggleButton
              iconOnly
              size="sm"
              active={alignment() === 'center'}
              onClick={() => setAlignment('center')}
              aria-label="Align Center"
            >
              <AlignCenterIcon />
            </ToggleButton>
            <ToggleButton
              iconOnly
              size="sm"
              active={alignment() === 'right'}
              onClick={() => setAlignment('right')}
              aria-label="Align Right"
            >
              <AlignRightIcon />
            </ToggleButton>
          </div>
        </ThemeComparison>
      </Hst.Variant>

      <Hst.Variant title="Interactive: View Mode Toggle">
        <ThemeComparison>
          <div style={{ display: 'flex', gap: '4px' }}>
            <ToggleButton size="sm" active={viewMode() === 'grid'} onClick={() => setViewMode('grid')}>
              <GridIcon /> Grid
            </ToggleButton>
            <ToggleButton size="sm" active={viewMode() === 'list'} onClick={() => setViewMode('list')}>
              <ListIcon /> List
            </ToggleButton>
          </div>
        </ThemeComparison>
      </Hst.Variant>

      <Hst.Variant title="Disabled">
        <ThemeComparison>
          <ToggleButton disabled active={false}>
            Disabled Inactive
          </ToggleButton>
          <ToggleButton disabled active={true}>
            Disabled Active
          </ToggleButton>
          <ToggleButton iconOnly disabled active={false} aria-label="Disabled">
            <BoldIcon />
          </ToggleButton>
          <ToggleButton iconOnly disabled active={true} aria-label="Disabled Active">
            <BoldIcon />
          </ToggleButton>
        </ThemeComparison>
      </Hst.Variant>
    </Hst.Story>
  )
}
