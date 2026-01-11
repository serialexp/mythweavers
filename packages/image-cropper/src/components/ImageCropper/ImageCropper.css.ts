import { style } from '@vanilla-extract/css'

export const container = style({
  position: 'relative',
  overflow: 'hidden',
  backgroundColor: '#1a1a1a',
  cursor: 'grab',
  touchAction: 'none',
  userSelect: 'none',
  ':active': {
    cursor: 'grabbing',
  },
})

export const imageLayer = style({
  position: 'absolute',
  transformOrigin: '0 0',
  pointerEvents: 'none',
  userSelect: 'none',
  willChange: 'transform',
})

export const overlay = style({
  position: 'absolute',
  inset: 0,
  pointerEvents: 'none',
  boxShadow: 'inset 0 0 0 9999px rgba(0, 0, 0, 0.5)',
})

export const cropAreaCircle = style({
  position: 'absolute',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  borderRadius: '50%',
  boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.5)',
  pointerEvents: 'none',
})

export const cropAreaRect = style({
  position: 'absolute',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.5)',
  pointerEvents: 'none',
})

export const controls = style({
  position: 'absolute',
  bottom: 16,
  left: '50%',
  transform: 'translateX(-50%)',
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  padding: '8px 16px',
  backgroundColor: 'rgba(0, 0, 0, 0.7)',
  borderRadius: 8,
  backdropFilter: 'blur(4px)',
})

export const zoomLabel = style({
  color: 'rgba(255, 255, 255, 0.7)',
  fontSize: 12,
  fontFamily: 'system-ui, sans-serif',
  minWidth: 40,
  textAlign: 'center',
})

export const slider = style({
  width: 120,
  height: 4,
  appearance: 'none',
  backgroundColor: 'rgba(255, 255, 255, 0.2)',
  borderRadius: 2,
  outline: 'none',
  cursor: 'pointer',
  '::-webkit-slider-thumb': {
    appearance: 'none',
    width: 16,
    height: 16,
    backgroundColor: '#fff',
    borderRadius: '50%',
    cursor: 'pointer',
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.3)',
  },
  '::-moz-range-thumb': {
    width: 16,
    height: 16,
    backgroundColor: '#fff',
    borderRadius: '50%',
    cursor: 'pointer',
    border: 'none',
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.3)',
  },
})

export const zoomButton = style({
  width: 28,
  height: 28,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: 'rgba(255, 255, 255, 0.1)',
  border: 'none',
  borderRadius: 4,
  color: '#fff',
  fontSize: 18,
  fontWeight: 'bold',
  cursor: 'pointer',
  transition: 'background-color 0.15s',
  ':hover': {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  ':active': {
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  ':disabled': {
    opacity: 0.4,
    cursor: 'not-allowed',
  },
})
