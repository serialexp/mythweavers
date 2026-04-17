# TODO

## Shared SolidJS component package for MythWeavers apps

The MythWeavers apps (admin, reading-frontend-astro, story-editor) all use SolidJS + `@mythweavers/ui` and share common app-level components like login forms. Currently these are duplicated across apps.

We need a proper package (e.g. `@mythweavers/solid-app-components` or similar) to house composed SolidJS components that are shared between multiple apps but are too high-level/business-specific for the `@mythweavers/ui` design system package. The existing `@mythweavers/shared` package is pure data types/utilities with no UI framework dependency, so it's not the right place either.

Candidates for extraction:
- **LoginForm** — currently duplicated in story-editor, reading-frontend-astro, and admin (simplified version)
- Potentially other auth-related UI (registration form, forgot password)
