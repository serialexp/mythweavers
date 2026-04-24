import { style } from '@vanilla-extract/css'

export const section = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--spacing-sm)',
  padding: 'var(--spacing-md)',
  border: '1px solid var(--border-color)',
  borderRadius: 'var(--radius-md)',
  background: 'var(--bg-secondary)',
})

export const sectionTitle = style({
  fontSize: '1rem',
  fontWeight: 600,
  margin: 0,
  color: 'var(--text-primary)',
})

export const sectionSubtitle = style({
  fontSize: '0.85rem',
  color: 'var(--text-secondary)',
  margin: 0,
})

export const statusLine = style({
  display: 'flex',
  gap: 'var(--spacing-sm)',
  alignItems: 'center',
  fontSize: '0.9rem',
  color: 'var(--text-secondary)',
})

export const statusKey = style({
  fontWeight: 500,
  color: 'var(--text-primary)',
})

export const table = style({
  width: '100%',
  borderCollapse: 'collapse',
  fontSize: '0.85rem',
})

export const th = style({
  textAlign: 'left',
  padding: 'var(--spacing-xs) var(--spacing-sm)',
  borderBottom: '1px solid var(--border-color)',
  fontWeight: 600,
  color: 'var(--text-secondary)',
})

export const td = style({
  padding: 'var(--spacing-xs) var(--spacing-sm)',
  borderBottom: '1px solid var(--border-color)',
  verticalAlign: 'top',
})

export const chapterName = style({
  fontWeight: 500,
  color: 'var(--text-primary)',
})

export const errorCell = style({
  color: 'var(--danger-color)',
  fontSize: '0.8rem',
  maxWidth: '20rem',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
})

export const badge = style({
  display: 'inline-block',
  padding: '2px 8px',
  borderRadius: 'var(--radius-sm)',
  fontSize: '0.75rem',
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.03em',
})

export const badgeDraft = style({
  background: 'var(--bg-tertiary)',
  color: 'var(--text-muted)',
})

export const badgeScheduled = style({
  background: 'var(--bg-tertiary)',
  color: 'var(--primary-color)',
})

export const badgePublishing = style({
  background: 'var(--bg-tertiary)',
  color: 'var(--warning-color)',
})

export const badgePublished = style({
  background: 'var(--bg-tertiary)',
  color: 'var(--success-color)',
})

export const badgeFailed = style({
  background: 'var(--bg-tertiary)',
  color: 'var(--danger-color)',
})

export const badgeUnstarted = style({
  background: 'var(--bg-tertiary)',
  color: 'var(--text-muted)',
})

export const inlineRow = style({
  display: 'flex',
  gap: 'var(--spacing-sm)',
  alignItems: 'center',
  flexWrap: 'wrap',
})

export const empty = style({
  textAlign: 'center',
  padding: 'var(--spacing-md)',
  color: 'var(--text-muted)',
  fontSize: '0.9rem',
})

export const errorText = style({
  fontSize: '0.8rem',
  color: 'var(--danger-color)',
})
