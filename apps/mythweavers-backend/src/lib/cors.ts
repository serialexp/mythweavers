const DEFAULT_ALLOWED_ORIGINS = [
  'https://mythweavers.io',
  'https://www.mythweavers.io',
  'https://write.mythweavers.io',
  'https://admin.mythweavers.io',
  'http://localhost:3200',
  'http://localhost:3202',
  'http://localhost:3203',
  'http://localhost:3204',
]

function normalizeOrigin(value: string): string | null {
  try {
    return new URL(value).origin
  } catch {
    return null
  }
}

function withDefaultScheme(value: string): string {
  return /^https?:\/\//i.test(value) ? value : `https://${value}`
}

export function getAllowedOrigins(): ReadonlySet<string> {
  const configured = process.env.CORS_ORIGIN?.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)

  if (configured?.includes('*')) {
    throw new Error('CORS_ORIGIN cannot contain "*" while credentialed requests are enabled')
  }

  const candidates = configured?.length
    ? configured
    : [...DEFAULT_ALLOWED_ORIGINS, ...(process.env.EDITOR_URL ? [process.env.EDITOR_URL] : [])]

  return new Set(candidates.map(withDefaultScheme).map(normalizeOrigin).filter((origin): origin is string => origin !== null))
}

export function isAllowedOrigin(origin: string | undefined): boolean {
  if (!origin) return true
  const normalized = normalizeOrigin(origin)
  return normalized !== null && allowedOrigins.has(normalized)
}

const allowedOrigins = getAllowedOrigins()
