import { ThemeComparison } from '../../story-utils/ThemeComparison'
import { IconButton } from './IconButton'

// Simple icon components for demo purposes
const CloseIcon = () => (
  <svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <path d="M18 6L6 18M6 6l12 12" />
  </svg>
)

const PlusIcon = () => (
  <svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <path d="M12 5v14M5 12h14" />
  </svg>
)

const TrashIcon = () => (
  <svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2" />
  </svg>
)

const SettingsIcon = () => (
  <svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" />
  </svg>
)

export default (props: { Hst: any }) => {
  const { Hst } = props

  return (
    <Hst.Story title="IconButton" group="components">
      <Hst.Variant title="All Variants">
        <ThemeComparison>
          <IconButton aria-label="Close" variant="ghost">
            <CloseIcon />
          </IconButton>
          <IconButton aria-label="Settings" variant="secondary">
            <SettingsIcon />
          </IconButton>
          <IconButton aria-label="Add" variant="primary">
            <PlusIcon />
          </IconButton>
          <IconButton aria-label="Delete" variant="danger">
            <TrashIcon />
          </IconButton>
        </ThemeComparison>
      </Hst.Variant>

      <Hst.Variant title="Sizes">
        <ThemeComparison>
          <IconButton aria-label="Small" size="sm">
            <CloseIcon />
          </IconButton>
          <IconButton aria-label="Medium" size="md">
            <CloseIcon />
          </IconButton>
          <IconButton aria-label="Large" size="lg">
            <CloseIcon />
          </IconButton>
        </ThemeComparison>
      </Hst.Variant>

      <Hst.Variant title="Sizes (Primary)">
        <ThemeComparison>
          <IconButton aria-label="Small" variant="primary" size="sm">
            <PlusIcon />
          </IconButton>
          <IconButton aria-label="Medium" variant="primary" size="md">
            <PlusIcon />
          </IconButton>
          <IconButton aria-label="Large" variant="primary" size="lg">
            <PlusIcon />
          </IconButton>
        </ThemeComparison>
      </Hst.Variant>

      <Hst.Variant title="Disabled">
        <ThemeComparison>
          <IconButton aria-label="Disabled ghost" variant="ghost" disabled>
            <CloseIcon />
          </IconButton>
          <IconButton aria-label="Disabled secondary" variant="secondary" disabled>
            <SettingsIcon />
          </IconButton>
          <IconButton aria-label="Disabled primary" variant="primary" disabled>
            <PlusIcon />
          </IconButton>
          <IconButton aria-label="Disabled danger" variant="danger" disabled>
            <TrashIcon />
          </IconButton>
        </ThemeComparison>
      </Hst.Variant>
    </Hst.Story>
  )
}
