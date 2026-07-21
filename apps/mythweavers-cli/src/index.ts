#!/usr/bin/env node
import { spawn } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { mkdir, rename, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { Command } from 'commander'

const program = new Command()
type ApiError = { error?: string; error_description?: string }
type CliConfig = {
  version: 1
  endpoints: Record<string, { token: string; expiresAt?: string }>
}

const configDirectory = join(process.env.XDG_CONFIG_HOME || join(homedir(), '.config'), 'mythweavers')
const configPath = join(configDirectory, 'config.json')

function apiBaseUrl(): string {
  return (program.opts<{ api: string }>().api || process.env.MYTHWEAVERS_API_URL || 'http://localhost:3201').replace(
    /\/$/,
    '',
  )
}

function accessToken(): string | undefined {
  const explicitToken = program.opts<{ token?: string }>().token || process.env.MYTHWEAVERS_TOKEN
  if (explicitToken) return explicitToken

  const credentials = loadConfig().endpoints[apiBaseUrl()]
  if (!credentials) return undefined
  if (credentials.expiresAt && new Date(credentials.expiresAt) <= new Date()) return undefined
  return credentials.token
}

function loadConfig(): CliConfig {
  try {
    const parsed = JSON.parse(readFileSync(configPath, 'utf8')) as Partial<CliConfig>
    return { version: 1, endpoints: parsed.endpoints ?? {} }
  } catch (error) {
    const code = error && typeof error === 'object' && 'code' in error ? error.code : undefined
    if (code !== 'ENOENT')
      throw new Error(`Unable to read ${configPath}: ${error instanceof Error ? error.message : String(error)}`)
    return { version: 1, endpoints: {} }
  }
}

async function saveAccessToken(token: string, expiresIn?: number): Promise<void> {
  const config = loadConfig()
  config.endpoints[apiBaseUrl()] = {
    token,
    expiresAt: expiresIn ? new Date(Date.now() + expiresIn * 1000).toISOString() : undefined,
  }

  await mkdir(configDirectory, { recursive: true, mode: 0o700 })
  const temporaryPath = `${configPath}.tmp`
  await writeFile(temporaryPath, `${JSON.stringify(config, null, 2)}\n`, { mode: 0o600 })
  await rename(temporaryPath, configPath)
}

async function request<T>(path: string, options: RequestInit = {}, authenticated = true): Promise<T> {
  const token = accessToken()
  if (authenticated && !token)
    throw new Error('No access token. Run `mythweavers auth:login` or set MYTHWEAVERS_TOKEN.')
  const response = await fetch(`${apiBaseUrl()}${path}`, {
    ...options,
    headers: {
      Accept: 'application/json',
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(token && authenticated ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  })
  const body = (await response.json().catch(() => undefined)) as T | ApiError | undefined
  if (!response.ok) {
    const error = body as ApiError | undefined
    throw new Error(error?.error_description || error?.error || `${response.status} ${response.statusText}`)
  }
  return body as T
}

function print(value: unknown) {
  console.log(JSON.stringify(value, null, 2))
}
function delay(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds))
}
function openBrowser(url: string) {
  const command =
    process.platform === 'darwin'
      ? ['open', url]
      : process.platform === 'win32'
        ? ['cmd', '/c', 'start', '', url]
        : ['xdg-open', url]
  const child = spawn(command[0], command.slice(1), { detached: true, stdio: 'ignore' })
  child.unref()
}

program
  .name('mythweavers')
  .description('Command-line access to the MythWeavers API')
  .option('--api <url>', 'API base URL', process.env.MYTHWEAVERS_API_URL || 'http://localhost:3201')
  .option('--token <token>', 'Bearer access token (or set MYTHWEAVERS_TOKEN)')
  .showHelpAfterError()

program
  .command('auth:login')
  .description('Sign in through the browser using OAuth device authorization')
  .option('--no-open', 'Do not open the browser automatically')
  .option('--no-poll', 'Print the device code without waiting')
  .action(async (options: { open: boolean; poll: boolean }) => {
    const device = await request<{
      device_code: string
      user_code: string
      verification_uri: string
      expires_in: number
      interval: number
    }>('/oauth/device', { method: 'POST', body: JSON.stringify({ client_id: 'mythweavers-cli' }) }, false)
    const authorizationUrl = `${device.verification_uri}?code=${encodeURIComponent(device.user_code)}`
    console.log(`Open ${authorizationUrl} to authorize this CLI.`)
    if (options.open) openBrowser(authorizationUrl)
    if (!options.poll) return
    console.log('Waiting for authorization...')
    const deadline = Date.now() + device.expires_in * 1000
    while (Date.now() < deadline) {
      await delay(device.interval * 1000)
      const response = await fetch(`${apiBaseUrl()}/oauth/token`, {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({
          grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
          device_code: device.device_code,
          client_id: 'mythweavers-cli',
        }),
      })
      const body = (await response.json()) as {
        access_token?: string
        expires_in?: number
        error?: string
        error_description?: string
      }
      if (response.ok && body.access_token) {
        await saveAccessToken(body.access_token, body.expires_in)
        console.log(`\nAuthenticated. Credentials for ${apiBaseUrl()} were saved to ${configPath}.`)
        return
      }
      if (body.error === 'authorization_pending') continue
      throw new Error(body.error_description || body.error || 'Device authorization failed')
    }
    throw new Error('Device authorization timed out')
  })

program
  .command('stories:list')
  .description('List stories available to the authenticated user')
  .option('--search <text>', 'Filter by title or summary')
  .action(async (options: { search?: string }) => {
    const query = new URLSearchParams({ page: '1', pageSize: '100' })
    if (options.search) query.set('search', options.search)
    print(await request(`/my/stories?${query}`))
  })
program
  .command('story:show')
  .description('Show story metadata')
  .argument('<storyId>')
  .action(async (id: string) => print(await request(`/my/stories/${encodeURIComponent(id)}`)))
program
  .command('nodes:list')
  .description('Load the complete story hierarchy')
  .argument('<storyId>')
  .action(async (id: string) => print(await request(`/my/stories/${encodeURIComponent(id)}/load-story`)))
program
  .command('messages:list')
  .description('List messages in a scene')
  .argument('<sceneId>')
  .action(async (id: string) => print(await request(`/my/scenes/${encodeURIComponent(id)}/messages`)))
program
  .command('messages:read')
  .description('Read a message')
  .argument('<messageId>')
  .action(async (id: string) => print(await request(`/my/messages/${encodeURIComponent(id)}`)))
program
  .command('characters:list')
  .description('List a story’s characters')
  .argument('<storyId>')
  .action(async (id: string) => print(await request(`/my/stories/${encodeURIComponent(id)}/characters`)))

program.parseAsync().catch((error: unknown) => {
  console.error(`Error: ${error instanceof Error ? error.message : String(error)}`)
  process.exitCode = 1
})
