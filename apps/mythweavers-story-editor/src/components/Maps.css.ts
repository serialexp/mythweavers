import { style, keyframes, globalStyle } from '@vanilla-extract/css'
import { tokens } from '@mythweavers/ui/tokens'

export const mapsPanel = style({
  display: 'flex',
  flexDirection: 'column',
  height: '100%',
  gap: '1rem',
  padding: '1rem',
})

export const mapSelector = style({
  display: 'flex',
  flexDirection: 'column',
  gap: '0.5rem',
})

export const mapSelectorHeader = style({
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: '0.5rem',
})

globalStyle(`${mapSelectorHeader} h4`, {
  margin: 0,
  color: tokens.color.text.primary,
})

export const mapDropdown = style({
  display: 'flex',
  gap: '0.5rem',
  alignItems: 'center',
})

export const mapSelect = style({
  flex: 1,
  padding: '0.5rem',
  background: tokens.color.bg.raised,
  color: tokens.color.text.primary,
  border: `1px solid ${tokens.color.border.default}`,
  borderRadius: '4px',
  fontSize: '0.9rem',
})

export const mapActions = style({
  display: 'flex',
  gap: '0.5rem',
})

export const iconButton = style({
  padding: '0.5rem',
  background: tokens.color.bg.elevated,
  color: tokens.color.text.primary,
  border: `1px solid ${tokens.color.border.default}`,
  borderRadius: '4px',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  transition: 'background-color 0.2s',
  ':hover': {
    background: 'var(--bg-quaternary)',
  },
  ':disabled': {
    opacity: 0.5,
    cursor: 'not-allowed',
  },
})

export const deleteButton = style({
  background: 'var(--danger-bg)',
  color: tokens.color.semantic.error,
  borderColor: 'var(--danger-border)',
  selectors: {
    '&:hover:not(:disabled)': {
      background: 'var(--danger-bg-hover)',
    },
  },
})

export const addMapSection = style({
  display: 'flex',
  flexDirection: 'column',
  gap: '0.5rem',
  padding: '1rem',
  background: tokens.color.bg.raised,
  borderRadius: '4px',
  border: `1px solid ${tokens.color.border.default}`,
})

globalStyle(`${addMapSection} h4`, {
  margin: '0 0 0.5rem 0',
  color: tokens.color.text.primary,
})

export const mapNameInput = style({
  padding: '0.5rem',
  background: tokens.color.bg.base,
  color: tokens.color.text.primary,
  border: `1px solid ${tokens.color.border.default}`,
  borderRadius: '4px',
  fontSize: '0.9rem',
})

export const fileUpload = style({
  position: 'relative',
  display: 'flex',
  flexDirection: 'column',
  gap: '0.5rem',
})

export const fileInput = style({
  display: 'none',
})

export const fileInputLabel = style({
  padding: '0.75rem',
  background: tokens.color.bg.elevated,
  color: tokens.color.text.primary,
  border: `2px dashed ${tokens.color.border.default}`,
  borderRadius: '4px',
  cursor: 'pointer',
  textAlign: 'center',
  transition: 'all 0.2s',
  ':hover': {
    background: 'var(--bg-quaternary)',
    borderColor: tokens.color.accent.primary,
  },
})

export const selectedFile = style({
  padding: '0.5rem',
  background: tokens.color.bg.elevated,
  color: tokens.color.text.secondary,
  borderRadius: '4px',
  fontSize: '0.85rem',
  wordBreak: 'break-all',
})

export const addMapButton = style({
  padding: '0.75rem',
  background: 'var(--accent-bg)',
  color: tokens.color.accent.primary,
  border: '1px solid var(--accent-border)',
  borderRadius: '4px',
  cursor: 'pointer',
  fontWeight: 500,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '0.5rem',
  transition: 'all 0.2s',
  selectors: {
    '&:hover:not(:disabled)': {
      background: 'var(--accent-bg-hover)',
    },
  },
  ':disabled': {
    opacity: 0.5,
    cursor: 'not-allowed',
  },
})

export const mapViewer = style({
  flex: 1,
  position: 'relative',
  background: tokens.color.bg.raised,
  border: `1px solid ${tokens.color.border.default}`,
  borderRadius: '4px',
  overflow: 'hidden',
  minHeight: '400px',
  display: 'flex',
  gap: 0,
})

export const mapContainer = style({
  flex: 1,
  position: 'relative',
  overflow: 'hidden',
  '@media': {
    '(max-width: 768px)': {
      width: '100%',
    },
  },
})

export const overlayControls = style({
  position: 'absolute',
  top: '10px',
  right: '10px',
  zIndex: 100,
  background: tokens.color.bg.base,
  border: `1px solid ${tokens.color.border.default}`,
  borderRadius: '4px',
  padding: '0.5rem',
  boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)',
  display: 'flex',
  flexDirection: 'column',
  gap: '0.5rem',
})

export const overlayToggle = style({
  display: 'flex',
  alignItems: 'center',
  gap: '0.5rem',
  cursor: 'pointer',
  color: tokens.color.text.primary,
  fontSize: '0.9rem',
  userSelect: 'none',
})

globalStyle(`${overlayToggle} input[type="checkbox"]`, {
  cursor: 'pointer',
})

export const overlayMethodSelect = style({
  padding: '0.25rem 0.5rem',
  background: tokens.color.bg.raised,
  color: tokens.color.text.primary,
  border: `1px solid ${tokens.color.border.default}`,
  borderRadius: '3px',
  fontSize: '0.85rem',
  cursor: 'pointer',
  minWidth: '150px',
  ':hover': {
    background: tokens.color.bg.elevated,
  },
})

globalStyle(`${overlayMethodSelect} option:disabled`, {
  color: tokens.color.text.secondary,
  fontStyle: 'italic',
})

export const paintControls = style({
  position: 'absolute',
  top: '70px',
  right: '10px',
  zIndex: 100,
  background: 'white',
  padding: '0.75rem',
  borderRadius: 'var(--radius-md)',
  boxShadow: 'var(--shadow-md)',
  display: 'flex',
  alignItems: 'center',
  flexDirection: 'row',
  gap: '0.75rem',
})

export const paintToggle = style({
  display: 'flex',
  alignItems: 'center',
  gap: '0.5rem',
  cursor: 'pointer',
  fontSize: '0.875rem',
  fontWeight: 500,
  userSelect: 'none',
  color: '#333',
})

globalStyle(`${paintToggle} input[type="checkbox"]`, {
  cursor: 'pointer',
})

export const paintFactionSelect = style({
  padding: '0.4rem 0.6rem',
  background: tokens.color.bg.raised,
  color: tokens.color.text.primary,
  border: `1px solid ${tokens.color.border.default}`,
  borderRadius: 'var(--radius-sm)',
  fontSize: '0.875rem',
  cursor: 'pointer',
  minWidth: '150px',
  ':hover': {
    background: tokens.color.bg.elevated,
  },
})

export const landmarksList = style({
  width: '250px',
  background: tokens.color.bg.base,
  borderLeft: `1px solid ${tokens.color.border.default}`,
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
  '@media': {
    '(max-width: 768px)': {
      display: 'none',
    },
  },
})

export const landmarksListHeader = style({
  padding: '0.75rem',
  background: tokens.color.bg.raised,
  borderBottom: `1px solid ${tokens.color.border.default}`,
  fontWeight: 600,
  fontSize: '0.9rem',
  color: tokens.color.text.primary,
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
})

export const sortButton = style({
  padding: '0.25rem 0.5rem',
  background: tokens.color.bg.elevated,
  color: tokens.color.text.secondary,
  border: `1px solid ${tokens.color.border.default}`,
  borderRadius: '3px',
  cursor: 'pointer',
  fontSize: '0.8rem',
  transition: 'all 0.2s',
  ':hover': {
    background: 'var(--bg-quaternary)',
    color: tokens.color.text.primary,
  },
})

export const landmarksListContent = style({
  flex: 1,
  overflowY: 'auto',
  padding: '0.5rem',
})

export const landmarkListItem = style({
  padding: '0.5rem',
  marginBottom: '0.25rem',
  background: tokens.color.bg.raised,
  border: `1px solid ${tokens.color.border.default}`,
  borderRadius: '4px',
  cursor: 'pointer',
  transition: 'all 0.2s',
  display: 'flex',
  alignItems: 'center',
  gap: '0.5rem',
  ':hover': {
    background: tokens.color.bg.elevated,
    borderColor: tokens.color.accent.primary,
  },
})

export const landmarkListItemSelected = style({
  background: 'var(--accent-bg)',
  borderColor: 'var(--accent-border)',
  color: tokens.color.accent.primary,
})

export const landmarkColorDot = style({
  width: '12px',
  height: '12px',
  borderRadius: '50%',
  flexShrink: 0,
  border: '1px solid rgba(255, 255, 255, 0.2)',
})

export const landmarkListName = style({
  flex: 1,
  fontSize: '0.85rem',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
})

export const emptyLandmarksList = style({
  padding: '1rem',
  textAlign: 'center',
  color: tokens.color.text.secondary,
  fontSize: '0.85rem',
})

export const mapCanvas = style({
  width: '100%',
  height: '100%',
  position: 'absolute',
  top: 0,
  left: 0,
})

export const noMapMessage = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  height: '100%',
  color: tokens.color.text.secondary,
  fontSize: '1.1rem',
  textAlign: 'center',
  padding: '2rem',
})

export const landmarkPopup = style({
  position: 'absolute',
  background: tokens.color.bg.base,
  border: `1px solid ${tokens.color.border.default}`,
  borderRadius: '6px',
  padding: '0.75rem',
  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
  zIndex: 1000,
  width: '280px',
  maxWidth: 'calc(100vw - 20px)',
  maxHeight: '400px',
  overflowY: 'auto',
})

export const landmarkPopupContent = style({
  display: 'flex',
  flexDirection: 'column',
  gap: '0.5rem',
})

export const landmarkName = style({
  fontWeight: 600,
  color: tokens.color.text.primary,
  marginBottom: '0.25rem',
})

export const landmarkDescription = style({
  color: tokens.color.text.secondary,
  fontSize: '0.9rem',
  lineHeight: 1.4,
})

export const landmarkDetails = style({
  marginTop: '0.75rem',
  paddingTop: '0.75rem',
  borderTop: `1px solid ${tokens.color.border.default}`,
})

export const landmarkDetailRow = style({
  display: 'flex',
  alignItems: 'center',
  gap: '0.5rem',
  marginBottom: '0.5rem',
  fontSize: '0.85rem',
  ':last-child': {
    marginBottom: 0,
  },
})

export const landmarkDetailLabel = style({
  color: tokens.color.text.secondary,
  fontWeight: 500,
  minWidth: '70px',
})

export const landmarkDetailValue = style({
  color: tokens.color.text.primary,
  flex: 1,
})

export const landmarkActions = style({
  display: 'flex',
  gap: '0.5rem',
  marginTop: '0.5rem',
  paddingTop: '0.5rem',
  borderTop: `1px solid ${tokens.color.border.default}`,
})

export const landmarkButton = style({
  flex: 1,
  padding: '0.4rem 0.6rem',
  background: tokens.color.bg.elevated,
  color: tokens.color.text.primary,
  border: `1px solid ${tokens.color.border.default}`,
  borderRadius: '4px',
  cursor: 'pointer',
  fontSize: '0.85rem',
  transition: 'background-color 0.2s',
  ':hover': {
    background: 'var(--bg-quaternary)',
  },
})

export const landmarkButtonDelete = style({
  background: 'var(--danger-bg)',
  color: tokens.color.semantic.error,
  borderColor: 'var(--danger-border)',
  ':hover': {
    background: 'var(--danger-bg-hover)',
  },
})

export const landmarkEditForm = style({
  display: 'flex',
  flexDirection: 'column',
  gap: '0.5rem',
  width: '100%',
  maxWidth: '100%',
})

export const landmarkInput = style({
  padding: '0.5rem',
  background: tokens.color.bg.raised,
  color: tokens.color.text.primary,
  border: `1px solid ${tokens.color.border.default}`,
  borderRadius: '4px',
  fontSize: '0.9rem',
  width: '100%',
  boxSizing: 'border-box',
})

export const landmarkTextarea = style({
  padding: '0.5rem',
  background: tokens.color.bg.raised,
  color: tokens.color.text.primary,
  border: `1px solid ${tokens.color.border.default}`,
  borderRadius: '4px',
  fontSize: '0.9rem',
  fontFamily: 'inherit',
  resize: 'vertical',
  minHeight: '80px',
  width: '100%',
  boxSizing: 'border-box',
})

export const landmarkSelect = style({
  padding: '0.5rem',
  background: tokens.color.bg.raised,
  color: tokens.color.text.primary,
  border: `1px solid ${tokens.color.border.default}`,
  borderRadius: '4px',
  fontSize: '0.9rem',
  width: '100%',
  boxSizing: 'border-box',
  cursor: 'pointer',
})

export const inputError = style({
  borderColor: '#e74c3c !important',
})

export const errorMessage = style({
  color: '#e74c3c',
  fontSize: '0.8rem',
  marginTop: '0.25rem',
  display: 'block',
})

export const colorPicker = style({
  display: 'flex',
  flexDirection: 'column',
  gap: '0.5rem',
  width: '100%',
})

export const colorPickerRow = style({
  display: 'flex',
  gap: '0.5rem',
  alignItems: 'center',
  flexWrap: 'wrap',
})

export const colorPickerLabel = style({
  color: tokens.color.text.secondary,
  fontSize: '0.9rem',
  flexShrink: 0,
})

export const colorInput = style({
  width: '60px',
  flexShrink: 0,
  padding: '0.25rem',
  background: tokens.color.bg.raised,
  border: `1px solid ${tokens.color.border.default}`,
  borderRadius: '4px',
  cursor: 'pointer',
})

export const colorQuickPicks = style({
  display: 'grid',
  gridTemplateColumns: 'repeat(4, 1fr)',
  gap: '0.25rem',
  width: '100%',
  maxWidth: '100%',
  '@media': {
    '(max-width: 768px)': {
      gridTemplateColumns: 'repeat(5, 1fr)',
      gap: '0.2rem',
    },
  },
})

export const colorQuickPick = style({
  width: '100%',
  aspectRatio: '1',
  borderRadius: '50%',
  cursor: 'pointer',
  maxWidth: '40px',
  border: '2px solid transparent',
  transition: 'all 0.2s',
  position: 'relative',
  ':hover': {
    transform: 'scale(1.15)',
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  '@media': {
    '(max-width: 768px)': {
      maxWidth: '30px',
    },
  },
})

export const colorQuickPickSelected = style({
  borderColor: tokens.color.accent.primary,
  boxShadow: `0 0 0 2px ${tokens.color.bg.base}`,
})

export const colorQuickPickWhite = style({
  border: `2px solid ${tokens.color.border.default}`,
  ':hover': {
    borderColor: tokens.color.accent.primary,
  },
})

// Alias for white color picker item
export const white = colorQuickPickWhite

export const sizePicker = style({
  display: 'flex',
  flexDirection: 'column',
  gap: '0.5rem',
  width: '100%',
})

export const sizePickerLabel = style({
  color: tokens.color.text.secondary,
  fontSize: '0.9rem',
})

export const sizeButtons = style({
  display: 'flex',
  gap: '0.25rem',
  width: '100%',
})

export const sizeButton = style({
  flex: 1,
  padding: '0.4rem 0.6rem',
  background: tokens.color.bg.elevated,
  color: tokens.color.text.primary,
  border: `1px solid ${tokens.color.border.default}`,
  borderRadius: '4px',
  cursor: 'pointer',
  fontSize: '0.85rem',
  transition: 'all 0.2s',
  minWidth: 0,
  ':hover': {
    background: 'var(--bg-quaternary)',
  },
})

export const sizeButtonSelected = style({
  background: 'var(--accent-bg)',
  color: tokens.color.accent.primary,
  borderColor: 'var(--accent-border)',
})

// Alias for general "selected" state (used on buttons, color pickers, etc.)
export const selected = sizeButtonSelected

export const landmarkFormActions = style({
  display: 'flex',
  gap: '0.5rem',
  marginTop: '0.5rem',
})

export const landmarkSaveButton = style({
  flex: 1,
  padding: '0.5rem',
  background: 'var(--accent-bg)',
  color: tokens.color.accent.primary,
  border: '1px solid var(--accent-border)',
  borderRadius: '4px',
  cursor: 'pointer',
  fontWeight: 500,
  transition: 'background-color 0.2s',
  selectors: {
    '&:hover:not(:disabled)': {
      background: 'var(--accent-bg-hover)',
    },
  },
  ':disabled': {
    opacity: 0.5,
    cursor: 'not-allowed',
    background: tokens.color.bg.elevated,
    color: tokens.color.text.secondary,
  },
})

export const landmarkCancelButton = style({
  flex: 1,
  padding: '0.5rem',
  background: tokens.color.bg.elevated,
  color: tokens.color.text.primary,
  border: `1px solid ${tokens.color.border.default}`,
  borderRadius: '4px',
  cursor: 'pointer',
  transition: 'background-color 0.2s',
  ':hover': {
    background: 'var(--bg-quaternary)',
  },
})

export const timelineSection = style({
  display: 'flex',
  flexDirection: 'column',
  gap: '0.5rem',
  padding: '1rem',
  background: tokens.color.bg.raised,
  borderRadius: '4px',
  border: `1px solid ${tokens.color.border.default}`,
})

export const timelineHeader = style({
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  color: tokens.color.text.primary,
  fontSize: '0.9rem',
})

export const timelineActions = style({
  display: 'flex',
  alignItems: 'center',
  gap: '0.75rem',
})

export const zoomControls = style({
  display: 'flex',
  alignItems: 'center',
  gap: '0.25rem',
  background: tokens.color.bg.base,
  border: `1px solid ${tokens.color.border.default}`,
  borderRadius: '4px',
  padding: '0.25rem',
})

export const zoomButton = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '24px',
  height: '24px',
  padding: 0,
  background: 'transparent',
  color: tokens.color.text.primary,
  border: 'none',
  borderRadius: '3px',
  cursor: 'pointer',
  transition: 'all 0.2s',
  selectors: {
    '&:hover:not(:disabled)': {
      background: tokens.color.bg.elevated,
    },
  },
  ':disabled': {
    opacity: 0.3,
    cursor: 'not-allowed',
  },
})

globalStyle(`${zoomButton} svg`, {
  width: '14px',
  height: '14px',
})

export const zoomLabel = style({
  fontSize: '0.75rem',
  color: tokens.color.text.secondary,
  padding: '0 0.25rem',
  minWidth: '60px',
  textAlign: 'center',
})

export const resetTimelineButton = style({
  padding: '0.25rem 0.75rem',
  background: tokens.color.bg.elevated,
  color: tokens.color.text.primary,
  border: `1px solid ${tokens.color.border.default}`,
  borderRadius: '4px',
  cursor: 'pointer',
  fontSize: '0.85rem',
  transition: 'background-color 0.2s',
  selectors: {
    '&:hover:not(:disabled)': {
      background: 'var(--bg-quaternary)',
    },
  },
  ':disabled': {
    opacity: 0.5,
    cursor: 'not-allowed',
  },
})

export const timelineInfo = style({
  display: 'flex',
  flexDirection: 'column',
  gap: '0.25rem',
  flex: 1,
})

export const timelinePosition = style({
  fontSize: '0.9rem',
  fontWeight: 600,
  color: tokens.color.text.primary,
})

export const timelineRawTime = style({
  fontSize: '0.75rem',
  color: tokens.color.text.secondary,
  fontFamily: '"Courier New", monospace',
  opacity: 0.7,
})

export const timelineChapter = style({
  fontSize: '0.85rem',
  color: tokens.color.accent.primary,
  fontWeight: 500,
})

export const timelinePreview = style({
  fontSize: '0.85rem',
  color: tokens.color.text.secondary,
  padding: '0.5rem 0',
  lineHeight: 1.4,
  borderTop: `1px solid ${tokens.color.border.default}`,
  marginTop: '0.25rem',
})

export const timelineControls = style({
  display: 'flex',
  alignItems: 'center',
  gap: '0.5rem',
  marginTop: '0.5rem',
})

export const timelineStepButton = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '32px',
  height: '32px',
  padding: 0,
  background: tokens.color.bg.elevated,
  color: tokens.color.text.primary,
  border: `1px solid ${tokens.color.border.default}`,
  borderRadius: '6px',
  cursor: 'pointer',
  transition: 'all 0.2s',
  flexShrink: 0,
  selectors: {
    '&:hover:not(:disabled)': {
      background: 'var(--bg-quaternary)',
      transform: 'scale(1.05)',
    },
  },
  ':disabled': {
    opacity: 0.3,
    cursor: 'not-allowed',
  },
})

globalStyle(`${timelineStepButton} svg`, {
  width: '16px',
  height: '16px',
})

export const timelineSliderContainer = style({
  flex: 1,
  position: 'relative',
  display: 'flex',
  alignItems: 'center',
})

export const timelineSlider = style({
  flex: 1,
  height: '24px',
  background: tokens.color.bg.elevated,
  borderRadius: '12px',
  outline: 'none',
  WebkitAppearance: 'none',
  appearance: 'none',
})

globalStyle(`${timelineSlider}::-webkit-slider-thumb`, {
  WebkitAppearance: 'none',
  appearance: 'none',
  width: '20px',
  height: '20px',
  background: tokens.color.accent.primary,
  borderRadius: '50%',
  cursor: 'pointer',
  border: '2px solid var(--accent-border)',
  zIndex: 2,
  position: 'relative',
})

globalStyle(`${timelineSlider}::-moz-range-thumb`, {
  width: '20px',
  height: '20px',
  background: tokens.color.accent.primary,
  borderRadius: '50%',
  cursor: 'pointer',
  border: '2px solid var(--accent-border)',
  zIndex: 2,
  position: 'relative',
})

export const timelineIndicators = style({
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  height: '24px',
  pointerEvents: 'none',
  zIndex: 1,
})

export const timelineIndicator = style({
  position: 'absolute',
  width: '6px',
  height: '6px',
  background: 'var(--warning-color)',
  borderRadius: '50%',
  top: '50%',
  transform: 'translate(-50%, -50%)',
  boxShadow: '0 0 4px rgba(255, 193, 7, 0.6)',
  pointerEvents: 'none',
})

export const fleetIndicator = style({
  position: 'absolute',
  width: '6px',
  height: '6px',
  background: '#00d4ff',
  borderRadius: '50%',
  top: '50%',
  transform: 'translate(-50%, -50%)',
  boxShadow: '0 0 4px rgba(0, 212, 255, 0.6)',
  pointerEvents: 'none',
})

const spin = keyframes({
  from: {
    transform: 'rotate(0deg)',
  },
  to: {
    transform: 'rotate(360deg)',
  },
})

globalStyle('.animate-spin', {
  animation: `${spin} 1s linear infinite`,
})

export const allegianceSection = style({
  display: 'flex',
  flexDirection: 'column',
  gap: '0.5rem',
  padding: '0.75rem 0',
  borderTop: `1px solid ${tokens.color.border.default}`,
  borderBottom: `1px solid ${tokens.color.border.default}`,
  margin: '0.5rem 0',
})

export const allegianceHeader = style({
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: '0.5rem',
})

export const allegianceLabel = style({
  fontSize: '0.85rem',
  color: tokens.color.text.secondary,
  fontWeight: 500,
})

export const jumpButton = style({
  display: 'flex',
  alignItems: 'center',
  gap: '0.25rem',
  padding: '0.25rem 0.5rem',
  background: tokens.color.bg.elevated,
  color: tokens.color.accent.primary,
  border: '1px solid var(--accent-border)',
  borderRadius: '4px',
  fontSize: '0.75rem',
  cursor: 'pointer',
  transition: 'all 0.2s',
  ':hover': {
    background: 'var(--accent-bg)',
    transform: 'translateY(-1px)',
  },
})

globalStyle(`${jumpButton} svg`, {
  width: '12px',
  height: '12px',
})

export const allegianceButtons = style({
  display: 'grid',
  gridTemplateColumns: 'repeat(2, 1fr)',
  gap: '0.5rem',
})

export const allegianceButton = style({
  padding: '0.4rem 0.6rem',
  border: '2px solid',
  borderRadius: '6px',
  fontSize: '0.85rem',
  fontWeight: 500,
  cursor: 'pointer',
  transition: 'all 0.2s ease',
  background: 'transparent',
  minHeight: '32px',
  selectors: {
    '&:hover:not(:disabled)': {
      transform: 'translateY(-1px)',
      boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)',
    },
  },
  ':disabled': {
    opacity: 0.5,
    cursor: 'not-allowed',
  },
})

export const allegianceButtonSelected = style({
  boxShadow: '0 0 0 3px rgba(255, 255, 255, 0.2)',
})

export const allegianceButtonInherited = style({
  cursor: 'default',
  fontStyle: 'italic',
  selectors: {
    '&:hover:not(:disabled)': {
      transform: 'none',
      boxShadow: 'none',
    },
  },
})

// Alias for inherited allegiance state
export const inherited = allegianceButtonInherited

export const savingIndicator = style({
  display: 'flex',
  alignItems: 'center',
  gap: '0.5rem',
  fontSize: '0.85rem',
  color: tokens.color.text.secondary,
  marginTop: '0.25rem',
})

export const fetchInfoButton = style({
  display: 'flex',
  alignItems: 'center',
  gap: '0.5rem',
  padding: '0.5rem 1rem',
  background: tokens.color.accent.primary,
  color: 'white',
  border: 'none',
  borderRadius: '4px',
  cursor: 'pointer',
  fontSize: '0.9rem',
  transition: 'background-color 0.2s',
  marginBottom: '0.5rem',
  selectors: {
    '&:hover:not(:disabled)': {
      background: 'var(--primary-hover)',
    },
  },
  ':disabled': {
    background: tokens.color.bg.elevated,
    opacity: 0.7,
    cursor: 'not-allowed',
  },
})

export const landmarkFormHint = style({
  fontSize: '0.85rem',
  color: tokens.color.text.secondary,
  marginTop: '0.25rem',
  display: 'block',
})

export const chapterMarkers = style({
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  height: '24px',
  pointerEvents: 'none',
  zIndex: 2,
})

export const chapterMarker = style({
  position: 'absolute',
  width: '2px',
  height: '100%',
  background: tokens.color.accent.primary,
  top: 0,
  transform: 'translateX(-50%)',
  pointerEvents: 'auto',
  cursor: 'pointer',
  opacity: 0.6,
  transition: 'opacity 0.2s',
  ':hover': {
    opacity: 1,
    boxShadow: `0 0 8px ${tokens.color.accent.primary}`,
  },
})

export const timelineRangeLabels = style({
  display: 'flex',
  justifyContent: 'space-between',
  marginTop: '0.5rem',
  padding: '0 32px',
  fontSize: '0.7rem',
  color: tokens.color.text.secondary,
})

export const rangeLabel = style({
  fontStyle: 'italic',
  opacity: 0.8,
})

export const creationModeToggle = style({
  position: 'absolute',
  top: '10px',
  left: '10px',
  zIndex: 100,
  background: tokens.color.bg.base,
  border: `1px solid ${tokens.color.border.default}`,
  borderRadius: '6px',
  padding: '0.5rem',
  boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)',
  display: 'flex',
  gap: '0.5rem',
  '@media': {
    '(max-width: 768px)': {
      left: '50%',
      transform: 'translateX(-50%)',
    },
  },
})

export const modeButton = style({
  padding: '0.5rem 1rem',
  background: tokens.color.bg.elevated,
  color: tokens.color.text.primary,
  border: `1px solid ${tokens.color.border.default}`,
  borderRadius: '4px',
  cursor: 'pointer',
  fontSize: '0.85rem',
  fontWeight: 500,
  transition: 'all 0.2s',
  whiteSpace: 'nowrap',
  ':hover': {
    background: 'var(--bg-quaternary)',
  },
  '@media': {
    '(max-width: 768px)': {
      fontSize: '0.75rem',
      padding: '0.4rem 0.75rem',
    },
  },
})

export const modeButtonActive = style({
  background: 'var(--accent-bg)',
  color: tokens.color.accent.primary,
  borderColor: 'var(--accent-border)',
})

// Alias for compatibility with component usage
export const active = modeButtonActive

export const hyperlaneStatus = style({
  width: '100%',
  padding: '0.5rem',
  textAlign: 'center',
  fontSize: '0.8rem',
  color: tokens.color.text.secondary,
  background: tokens.color.bg.raised,
  borderRadius: '4px',
  marginTop: '0.5rem',
  border: `1px solid ${tokens.color.border.default}`,
})

export const landmarkFormGroup = style({
  display: 'flex',
  flexDirection: 'column',
  gap: '0.25rem',
  width: '100%',
})

globalStyle(`${landmarkFormGroup} label`, {
  fontSize: '0.85rem',
  color: tokens.color.text.secondary,
  fontWeight: 500,
})

export const landmarkFormLabel = style({
  fontSize: '0.85rem',
  color: tokens.color.text.secondary,
  fontWeight: 500,
  display: 'block',
})

export const landmarkFormRow = style({
  display: 'flex',
  flexDirection: 'column',
  gap: '0.25rem',
  width: '100%',
})
