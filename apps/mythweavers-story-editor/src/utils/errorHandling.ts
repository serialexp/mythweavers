// Error handling utilities

export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }
  if (typeof error === 'string') {
    return error
  }
  if (error && typeof error === 'object' && 'message' in error) {
    return String(error.message)
  }
  return 'An unknown error occurred'
}

export function getErrorName(error: unknown): string {
  if (error instanceof Error) {
    return error.name
  }
  if (error && typeof error === 'object' && 'name' in error) {
    return String(error.name)
  }
  return 'UnknownError'
}

export function getErrorStack(error: unknown): string | undefined {
  if (error instanceof Error) {
    return error.stack
  }
  if (error && typeof error === 'object' && 'stack' in error) {
    return String(error.stack)
  }
  return undefined
}

export function isError(error: unknown): error is Error {
  return error instanceof Error
}
