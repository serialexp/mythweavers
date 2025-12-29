import _MountStory from './mount.js'
import _RenderStory from './render.js'

export const MountStory = _MountStory
export const RenderStory = _RenderStory

export function generateSourceCode(variant: { source?: string }) {
  // Return the source we set in MountStory, or empty string
  return variant.source ?? ''
}
