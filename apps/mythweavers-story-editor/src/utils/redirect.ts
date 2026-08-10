/**
 * Where to send someone after they sign in.
 *
 * Only same-origin paths are honoured. A value must start with exactly one "/"
 * — "//evil.example" is a protocol-relative URL that browsers treat as
 * absolute, so it would turn our login page into an open redirector, and
 * "/oauth/consent" is exactly the kind of destination an attacker would want to
 * hijack.
 */
export function safeRedirectTarget(raw: string | string[] | undefined): string {
  const value = Array.isArray(raw) ? raw[0] : raw
  if (typeof value !== 'string') return '/stories'
  if (!value.startsWith('/') || value.startsWith('//')) return '/stories'
  return value
}
