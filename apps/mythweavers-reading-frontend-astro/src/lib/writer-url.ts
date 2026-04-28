/**
 * Build a URL into the Writer (story-editor) app from the reader.
 *
 * Convention: the writer is hosted at the same hostname as the reader, but
 * prefixed with `write.`. e.g. reader at `https://mythweavers.io` →
 * writer at `https://write.mythweavers.io`.
 *
 * On localhost (dev) we fall back to the writer's known dev port `:3203`.
 *
 * The browser-side `window.location` is the source of truth — this helper
 * is meant to be called from client islands. For SSR-rendered links use
 * `<a href={writerStoryUrl(id)} />` inside a `client:load` island so the
 * URL resolves on the user's actual host.
 */

export function getWriterBaseUrl(): string {
  if (typeof window === 'undefined') {
    // SSR fallback — value won't be embedded in HTML; islands recompute on mount.
    return import.meta.env.PUBLIC_EDITOR_URL || 'https://write.mythweavers.io'
  }
  const { protocol, host } = window.location
  if (host.includes('localhost') || host.startsWith('127.')) {
    return 'http://localhost:3203'
  }
  return `${protocol}//write.${host.replace(/^www\./, '')}`
}

export function writerStoryUrl(storyId: string): string {
  return `${getWriterBaseUrl()}/story/${storyId}`
}
