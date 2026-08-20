import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import type { FastifyInstance } from 'fastify'
import { buildApp, cleanDatabase } from './helpers.js'

describe('Adventure endpoints', () => {
  let app: FastifyInstance
  let auth: Record<string, string>

  beforeEach(async () => {
    app = await buildApp()
    await cleanDatabase()
    const registration = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: { email: 'adventure@example.com', username: 'adventurer', password: 'password123' },
    })
    const cookie = registration.cookies[0]
    auth = { [cookie.name]: cookie.value }
  })

  afterEach(async () => {
    await app.close()
  })

  async function create(name: string, data: Record<string, unknown>) {
    const response = await app.inject({ method: 'POST', url: '/my/adventures', cookies: auth, payload: { name, data } })
    expect(response.statusCode).toBe(201)
    return response.json().adventure
  }

  test('lists a bounded reusable setting preview without exposing adventure data', async () => {
    const longSetting = `The sky-cities drift above an endless storm. ${'Ancient engines hum beneath their streets. '.repeat(10)}`
    await create('Skybound', {
      worldBible: longSetting,
      settingDescription: 'A legacy opening that must not be preferred.',
      turns: [{ narrative: 'Secret full adventure data' }],
    })

    const response = await app.inject({ method: 'GET', url: '/my/adventures', cookies: auth })
    expect(response.statusCode).toBe(200)
    const item = response.json().adventures[0]
    expect(item.hasSetting).toBe(true)
    expect(item.settingPreview).toStartWith('The sky-cities drift')
    expect(item.settingPreview.length).toBeLessThanOrEqual(240)
    expect(item.settingPreview.endsWith('…')).toBe(true)
    expect(item.data).toBeUndefined()
    expect(JSON.stringify(item)).not.toContain('Secret full adventure data')
  })

  test('falls back to the legacy setting description and marks empty adventures', async () => {
    await create('Empty', { turns: [] })
    await create('Legacy', { settingDescription: 'A brass city at the edge of night.', turns: [] })

    const response = await app.inject({ method: 'GET', url: '/my/adventures', cookies: auth })
    const byName = Object.fromEntries(response.json().adventures.map((item: { name: string }) => [item.name, item]))
    expect(byName.Legacy).toMatchObject({ hasSetting: true, settingPreview: 'A brass city at the edge of night.' })
    expect(byName.Empty).toMatchObject({ hasSetting: false })
    expect(byName.Empty.settingPreview).toBeUndefined()
  })

  test('does not expose another user adventure for setting import', async () => {
    const adventure = await create('Private World', { worldBible: 'Private lore.' })
    const registration = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: { email: 'other@example.com', username: 'other-user', password: 'password123' },
    })
    const cookie = registration.cookies[0]
    const otherAuth = { [cookie.name]: cookie.value }

    const detail = await app.inject({ method: 'GET', url: `/my/adventures/${adventure.id}`, cookies: otherAuth })
    expect(detail.statusCode).toBe(404)

    const list = await app.inject({ method: 'GET', url: '/my/adventures', cookies: otherAuth })
    expect(list.json().adventures).toEqual([])
  })
})
