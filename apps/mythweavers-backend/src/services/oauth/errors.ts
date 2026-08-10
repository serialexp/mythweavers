/**
 * OAuth-shaped errors.
 *
 * These deliberately do NOT flow through the global Fastify error handler,
 * which renders `{ error: <message> }` from `error.message`. An OAuth client
 * parses `error` as a machine code from a fixed vocabulary (`invalid_grant`,
 * `invalid_client`, …) and will report "invalid OAuth error response" if it
 * finds prose there instead — which shows up as an unrecoverable client-side
 * failure rather than a retry. Routes catch these and serialize them verbatim.
 */

export type OAuthErrorCode =
  | 'invalid_request'
  | 'invalid_client'
  | 'invalid_grant'
  | 'unauthorized_client'
  | 'unsupported_grant_type'
  | 'unsupported_response_type'
  | 'invalid_scope'
  | 'invalid_target'
  | 'access_denied'
  | 'server_error'
  | 'invalid_redirect_uri'
  | 'invalid_client_metadata'

export class OAuthError extends Error {
  readonly code: OAuthErrorCode
  readonly status: number

  constructor(code: OAuthErrorCode, description: string, status = 400) {
    super(description)
    this.name = 'OAuthError'
    this.code = code
    this.status = status
  }

  toBody(): { error: OAuthErrorCode; error_description: string } {
    return { error: this.code, error_description: this.message }
  }
}

export function oauthError(code: OAuthErrorCode, description: string, status = 400): OAuthError {
  return new OAuthError(code, description, status)
}
