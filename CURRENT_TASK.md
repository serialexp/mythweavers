# Current Task: UI Design System

## Context

We've built a design system in `/packages/ui` using:
- SolidJS
- Vanilla Extract CSS
- Histoire for component documentation
- Dual themes: Chronicle (dark/fantasy) and Starlight (light/sci-fi)

---

## Completed Components

### Tier 1: Foundation
| Component | Features |
|-----------|----------|
| **Button** | Variants (primary, secondary, ghost, danger), sizes (sm, md, lg), iconOnly mode, spin effect on hover |
| **IconButton** | Circular icon button, variants, sizes, scale on hover |
| **Input** | Sizes, focus/disabled/invalid states |
| **Textarea** | Sizes, resize options, states |
| **Modal** | Portal-based, focus trap, escape/backdrop close, sizes, footer support, full a11y |

### Tier 2: Interactive Patterns
| Component | Features |
|-----------|----------|
| **Select** | Styled native select, sizes, custom dropdown arrow |
| **Dropdown** | Action menu with DropdownItem, DropdownDivider, alignRight, icon/danger support |
| **FormField** | Label, required/optional indicators, help text, error messages |

### Tier 3: Feedback & Display
| Component | Features |
|-----------|----------|
| **Tabs** | Tabs, TabList, Tab, TabPanel - underline/pills variants, icons, disabled |
| **Spinner** | Sizes (sm, md, lg, xl), accessible |
| **Badge** | Variants (default, primary, secondary, success, warning, error, info), sizes, icons |
| **Toast** | Variants, auto-dismiss, ToastContainer, title/message, close button |

### Tier 4: Layout Components
| Component | Features |
|-----------|----------|
| **Stack** | Vertical/horizontal flex, HStack/VStack shortcuts, gap sizes (xs-2xl), align/justify, wrap support |
| **Container** | Max-width sizes (sm-2xl, full), horizontal padding options, center content mode |
| **Grid** | Column counts (1-12, auto-fit), row counts, gap sizes, GridItem with col/row spanning |
| **Divider** | Horizontal/vertical, solid/dashed/dotted variants, color options (subtle/default/strong), spacing |

### Editor Components (moved from separate package)
| Component | Features |
|-----------|----------|
| **ProseMirrorEditor** | Full-featured rich text editor with paragraph management |
| **SceneEditor** | High-level scene editor with AI integration hooks |
| **Editor** | Simple single-paragraph editor |
| **RewriteModal** | Modal for custom rewrite instructions |
| **GenerateBetweenModal** | Modal for generating content between paragraphs |

---

## Theme System

- **Chronicle** (dark/fantasy): Warm blacks, parchment/amber, gold accents
- **Starlight** (light/sci-fi): Light backgrounds, blue primary, red secondary
- Global styles scoped to theme containers (won't affect non-themed UI)
- Design tokens via `createThemeContract`
- Separate theme export (`@mythweavers/ui/theme`) for build-time usage without SolidJS

---

## Package Exports

```typescript
// Full package with all components
import { Button, Modal, ProseMirrorEditor } from '@mythweavers/ui'

// Theme-only (safe for build-time/vanilla-extract)
import { tokens, chronicleTheme, starlightTheme } from '@mythweavers/ui/theme'

// Styles
import '@mythweavers/ui/styles'
```

---

## Bundle Size

- CSS: 32.5 kB (gzip: 5.9 kB)
- JS: 424.7 kB (gzip: 114.9 kB) - includes ProseMirror
- Theme only: 3.1 kB (gzip: 0.9 kB)

---

## Files of Interest

- `/packages/ui/src/components/` - All components including Editor
- `/packages/ui/src/theme/` - Token system and themes
- `/packages/ui/src/components/Editor/` - ProseMirror-based editor
- `/packages/ui/histoire.config.ts` - Histoire configuration
- `/packages/ui/src/story-utils/ThemeComparison.tsx` - Side-by-side theme display

---

## Potential Next Steps

### Enhancements
- Keyboard navigation for Dropdown (arrow keys)
- `prefers-reduced-motion` support
- More Toast positioning options (top, bottom-left, etc.)

### Additional Components (if needed)
- Avatar
- Card
- Tooltip
- Progress bar
- Switch/Toggle
