import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  mock,
  test,
} from 'bun:test'
import { promises as fs } from 'node:fs'
import sharp from 'sharp'
import type { FastifyInstance } from 'fastify'

import { getUploadDir } from '../src/lib/file-storage.js'
import { prisma } from '../src/lib/prisma.js'
import { buildApp, cleanDatabase } from './helpers.js'

/**
 * Tests for AI image generation routes:
 *   GET  /my/images/models
 *   POST /my/images/generate
 *
 * The upstream `ImageClient` is mocked via `mock.module` so tests don't reach
 * Cloudflare or OpenAI. The `resolveImageUpstream → createImageClient` chain
 * is fully exercised: we seed a real Provider + ImageModel and set the env
 * var the resolver looks up.
 */

// ---- Mocks ----------
//
// `generateImageMock` is the function each test reassigns to control the
// mock client's behavior (success, throw, abort). It must be referenced by
// the module mock via a stable getter so reassignments are visible after
// the module is required.
let generateImageMock: (opts: unknown) => Promise<{
  buffer: Uint8Array
  mimeType: string
  width?: number
  height?: number
}> = async () => {
  throw new Error('generateImageMock not configured for this test')
}

mock.module('../src/lib/image-clients.js', () => ({
  createImageClient: () => ({
    listImageModels: async () => ({ models: [] }),
    generateImage: (opts: unknown) => generateImageMock(opts),
  }),
}))

// ---- Test fixtures ----

let app: FastifyInstance
let sessionCookie: { name: string; value: string }
let secondCookie: { name: string; value: string }
let userId: number
let secondUserId: number
let storyId: string
let foreignStoryId: string
let providerId: string
let imageModelRowId: string

const TEST_MODEL_ID = '@cf/test/flux-test'
const TEST_ENV_KEY = 'IMAGES_TEST_API_KEY'

beforeAll(async () => {
  app = await buildApp()
  await app.ready()
})

afterAll(async () => {
  await app.close()
  await fs.rm(getUploadDir(), { recursive: true, force: true })
})

beforeEach(async () => {
  await cleanDatabase()
  // Image-specific tables also need cleaning (ledger/usage tied to user is
  // already wiped via cascade, but Provider + ImageModel are not in
  // cleanDatabase's list).
  await prisma.imageModel.deleteMany()
  await prisma.llmModel.deleteMany()
  await prisma.llmProviderTransaction.deleteMany()
  await prisma.provider.deleteMany()

  // Set env var the upstream resolver consults.
  process.env[TEST_ENV_KEY] = 'test-key-value'

  // --- Provider + Image model row ---
  const provider = await prisma.provider.create({
    data: {
      name: 'cloudflare-image-test',
      displayName: 'Cloudflare Image (test)',
      endpointUrl: 'https://api.cloudflare.example/test',
      protocol: 'CLOUDFLARE_IMAGE',
      envKeyName: TEST_ENV_KEY,
      enabled: true,
    },
  })
  providerId = provider.id

  const imageModel = await prisma.imageModel.create({
    data: {
      modelId: TEST_MODEL_ID,
      displayName: 'Flux Test',
      description: 'Test model — pricing FLAT 0.01',
      providerId,
      enabled: true,
      sortOrder: 0,
      defaultSteps: 4,
      maxWidth: 2048,
      maxHeight: 2048,
      pricingMode: 'FLAT_PER_IMAGE',
      priceFlat: 0.01,
      costFlat: 0.005,
    },
  })
  imageModelRowId = imageModel.id

  // --- Two users, with healthy balances ---
  const reg1 = await app.inject({
    method: 'POST',
    url: '/auth/register',
    payload: {
      email: 'imguser1@example.com',
      username: 'imguser1',
      password: 'password123',
    },
  })
  expect(reg1.statusCode).toBe(201)
  sessionCookie = reg1.cookies[0] as { name: string; value: string }
  userId = reg1.json().user.id

  const reg2 = await app.inject({
    method: 'POST',
    url: '/auth/register',
    payload: {
      email: 'imguser2@example.com',
      username: 'imguser2',
      password: 'password123',
    },
  })
  expect(reg2.statusCode).toBe(201)
  secondCookie = reg2.cookies[0] as { name: string; value: string }
  secondUserId = reg2.json().user.id

  await prisma.user.update({
    where: { id: userId },
    data: { balance: 5 },
  })
  await prisma.user.update({
    where: { id: secondUserId },
    data: { balance: 5 },
  })

  // --- One story per user ---
  const story1 = await app.inject({
    method: 'POST',
    url: '/my/stories',
    cookies: { [sessionCookie.name]: sessionCookie.value },
    payload: { name: 'Image Test Story' },
  })
  expect(story1.statusCode).toBe(201)
  storyId = story1.json().story.id

  const story2 = await app.inject({
    method: 'POST',
    url: '/my/stories',
    cookies: { [secondCookie.name]: secondCookie.value },
    payload: { name: 'Foreign Story' },
  })
  expect(story2.statusCode).toBe(201)
  foreignStoryId = story2.json().story.id

  // Reset mock to a sane default: returns a real PNG buffer so saveBuffer
  // can compute SHA256 + dimensions without sharp throwing.
  generateImageMock = async () => ({
    buffer: new Uint8Array(
      await sharp({
        create: {
          width: 256,
          height: 256,
          channels: 4,
          background: { r: 50, g: 100, b: 150, alpha: 1 },
        },
      })
        .png()
        .toBuffer(),
    ),
    mimeType: 'image/png',
    width: 256,
    height: 256,
  })
})

afterEach(() => {
  delete process.env[TEST_ENV_KEY]
})

// ----- GET /my/images/models -----

describe('GET /my/images/models', () => {
  test('returns the catalog of enabled models for an authed user', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/my/images/models',
      cookies: { [sessionCookie.name]: sessionCookie.value },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(Array.isArray(body.models)).toBe(true)
    expect(body.models).toHaveLength(1)
    const m = body.models[0]
    expect(m.name).toBe(TEST_MODEL_ID)
    expect(m.provider).toBe('cloudflare-image-test')
    expect(m.pricingMode).toBe('FLAT_PER_IMAGE')
    expect(m.pricing.priceFlat).toBe(0.01)
    // Cost columns must NEVER be exposed.
    expect((m as Record<string, unknown>).cost).toBeUndefined()
  })

  test('omits disabled models', async () => {
    await prisma.imageModel.update({
      where: { id: imageModelRowId },
      data: { enabled: false },
    })
    const res = await app.inject({
      method: 'GET',
      url: '/my/images/models',
      cookies: { [sessionCookie.name]: sessionCookie.value },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().models).toHaveLength(0)
  })

  test('returns 401 without auth', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/my/images/models',
    })
    expect(res.statusCode).toBe(401)
  })
})

// ----- POST /my/images/generate -----

describe('POST /my/images/generate', () => {
  const validBody = () => ({
    storyId,
    model: TEST_MODEL_ID,
    prompt: 'A misty forest at dusk, painterly',
    width: 512,
    height: 512,
  })

  test('returns 401 without auth', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/my/images/generate',
      payload: validBody(),
    })
    expect(res.statusCode).toBe(401)
  })

  test('returns 400 for empty prompt', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/my/images/generate',
      cookies: { [sessionCookie.name]: sessionCookie.value },
      payload: { ...validBody(), prompt: '' },
    })
    expect(res.statusCode).toBe(400)
  })

  test('returns 400 for missing prompt', async () => {
    const { prompt: _prompt, ...rest } = validBody()
    const res = await app.inject({
      method: 'POST',
      url: '/my/images/generate',
      cookies: { [sessionCookie.name]: sessionCookie.value },
      payload: rest,
    })
    expect(res.statusCode).toBe(400)
  })

  test('returns 400 for unknown model', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/my/images/generate',
      cookies: { [sessionCookie.name]: sessionCookie.value },
      payload: { ...validBody(), model: '@cf/does-not-exist' },
    })
    expect(res.statusCode).toBe(400)
    expect(res.json().error).toContain('not available')
  })

  test('returns 400 when provider is disabled', async () => {
    await prisma.provider.update({
      where: { id: providerId },
      data: { enabled: false },
    })
    const res = await app.inject({
      method: 'POST',
      url: '/my/images/generate',
      cookies: { [sessionCookie.name]: sessionCookie.value },
      payload: validBody(),
    })
    expect(res.statusCode).toBe(400)
  })

  test('returns 400 when provider env-var key is missing', async () => {
    delete process.env[TEST_ENV_KEY]
    const res = await app.inject({
      method: 'POST',
      url: '/my/images/generate',
      cookies: { [sessionCookie.name]: sessionCookie.value },
      payload: validBody(),
    })
    expect(res.statusCode).toBe(400)
  })

  test('returns 404 for a story owned by another user', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/my/images/generate',
      cookies: { [sessionCookie.name]: sessionCookie.value },
      payload: { ...validBody(), storyId: foreignStoryId },
    })
    expect(res.statusCode).toBe(404)
  })

  test('returns 404 for a non-existent story', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/my/images/generate',
      cookies: { [sessionCookie.name]: sessionCookie.value },
      payload: { ...validBody(), storyId: 'doesnotexist' },
    })
    expect(res.statusCode).toBe(404)
  })

  test('returns 402 when balance is below estimated cost', async () => {
    await prisma.user.update({
      where: { id: userId },
      data: { balance: 0.001 },
    })
    const res = await app.inject({
      method: 'POST',
      url: '/my/images/generate',
      cookies: { [sessionCookie.name]: sessionCookie.value },
      payload: validBody(),
    })
    expect(res.statusCode).toBe(402)
    expect(res.json().error).toContain('Insufficient balance')
  })

  test('happy path: creates File, ImageUsageLog, BalanceLedger and debits balance', async () => {
    const before = await prisma.user.findUnique({ where: { id: userId } })
    const res = await app.inject({
      method: 'POST',
      url: '/my/images/generate',
      cookies: { [sessionCookie.name]: sessionCookie.value },
      payload: validBody(),
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.success).toBe(true)
    expect(body.fileId).toBeTruthy()
    expect(body.path).toBeTruthy()
    expect(body.mimeType).toBe('image/png')
    expect(body.width).toBe(256)
    expect(body.height).toBe(256)
    expect(Number(body.costDebited)).toBeCloseTo(0.01, 6)

    // File row was created under the calling user.
    const file = await prisma.file.findUnique({ where: { id: body.fileId } })
    expect(file).not.toBeNull()
    expect(file?.ownerId).toBe(userId)
    expect(file?.mimeType).toBe('image/png')

    // ImageUsageLog row.
    const log = await prisma.imageUsageLog.findFirst({
      where: { userId },
    })
    expect(log).not.toBeNull()
    expect(log?.modelId).toBe(TEST_MODEL_ID)
    expect(log?.providerName).toBe('cloudflare-image-test')
    expect(log?.fileId).toBe(body.fileId)
    expect(log?.aborted).toBe(false)
    expect(log?.errored).toBe(false)
    expect(Number(log?.cost)).toBeCloseTo(0.01, 6)

    // BalanceLedger entry of type IMAGE_USAGE.
    const ledger = await prisma.balanceLedger.findFirst({
      where: { userId, type: 'IMAGE_USAGE' },
    })
    expect(ledger).not.toBeNull()
    expect(Number(ledger?.amount)).toBeCloseTo(-0.01, 6)
    expect(ledger?.imageUsageLogId).toBe(log?.id ?? null)

    // User.balance decremented by the exact cost.
    const after = await prisma.user.findUnique({ where: { id: userId } })
    expect(Number(after?.balance) - Number(before?.balance)).toBeCloseTo(
      -0.01,
      6,
    )
  })

  test('returns 502 when upstream throws, logs an errored ImageUsageLog, no balance debit', async () => {
    generateImageMock = async () => {
      throw new Error('upstream broke its leg')
    }
    const before = await prisma.user.findUnique({ where: { id: userId } })

    const res = await app.inject({
      method: 'POST',
      url: '/my/images/generate',
      cookies: { [sessionCookie.name]: sessionCookie.value },
      payload: validBody(),
    })
    expect(res.statusCode).toBe(502)
    expect(res.json().error).toContain('upstream broke its leg')

    // Errored log written.
    const log = await prisma.imageUsageLog.findFirst({ where: { userId } })
    expect(log?.errored).toBe(true)
    expect(Number(log?.cost)).toBe(0)

    // No ledger entry, no balance change.
    const ledger = await prisma.balanceLedger.findFirst({
      where: { userId, type: 'IMAGE_USAGE' },
    })
    expect(ledger).toBeNull()

    const after = await prisma.user.findUnique({ where: { id: userId } })
    expect(Number(after?.balance)).toBe(Number(before?.balance))
  })

  test('returns 429 when a generation is already in flight for the same user', async () => {
    // Block the first gen on a controllable promise.
    let release: () => void = () => {}
    const blocker = new Promise<void>((resolve) => {
      release = resolve
    })
    generateImageMock = async () => {
      await blocker
      return {
        buffer: new Uint8Array(
          await sharp({
            create: {
              width: 64,
              height: 64,
              channels: 4,
              background: { r: 0, g: 0, b: 0, alpha: 1 },
            },
          })
            .png()
            .toBuffer(),
        ),
        mimeType: 'image/png',
        width: 64,
        height: 64,
      }
    }

    // Fire the first gen but DON'T await it yet.
    const first = app.inject({
      method: 'POST',
      url: '/my/images/generate',
      cookies: { [sessionCookie.name]: sessionCookie.value },
      payload: validBody(),
    })

    // Yield so the route handler can claim the inFlight slot before we
    // dispatch the second request.
    await new Promise((resolve) => setTimeout(resolve, 25))

    const second = await app.inject({
      method: 'POST',
      url: '/my/images/generate',
      cookies: { [sessionCookie.name]: sessionCookie.value },
      payload: validBody(),
    })
    expect(second.statusCode).toBe(429)
    expect(second.json().error).toContain('already')

    // Let the first gen complete.
    release()
    const firstRes = await first
    expect(firstRes.statusCode).toBe(200)
  })

  test('clamps width/height to model maxWidth/maxHeight', async () => {
    let received: { width?: number; height?: number } | null = null
    generateImageMock = async (opts: unknown) => {
      received = opts as { width?: number; height?: number }
      return {
        buffer: new Uint8Array(
          await sharp({
            create: {
              width: 2048,
              height: 2048,
              channels: 4,
              background: { r: 0, g: 0, b: 0, alpha: 1 },
            },
          })
            .png()
            .toBuffer(),
        ),
        mimeType: 'image/png',
        width: 2048,
        height: 2048,
      }
    }

    const res = await app.inject({
      method: 'POST',
      url: '/my/images/generate',
      cookies: { [sessionCookie.name]: sessionCookie.value },
      payload: { ...validBody(), width: 4096, height: 4096 },
    })
    expect(res.statusCode).toBe(200)
    expect(received).not.toBeNull()
    expect(received!.width).toBe(2048)
    expect(received!.height).toBe(2048)
  })

  test('two different users may generate concurrently (concurrency lock is per-user)', async () => {
    let release: () => void = () => {}
    const blocker = new Promise<void>((resolve) => {
      release = resolve
    })
    generateImageMock = async () => {
      await blocker
      return {
        buffer: new Uint8Array(
          await sharp({
            create: {
              width: 64,
              height: 64,
              channels: 4,
              background: { r: 0, g: 0, b: 0, alpha: 1 },
            },
          })
            .png()
            .toBuffer(),
        ),
        mimeType: 'image/png',
        width: 64,
        height: 64,
      }
    }

    const first = app.inject({
      method: 'POST',
      url: '/my/images/generate',
      cookies: { [sessionCookie.name]: sessionCookie.value },
      payload: validBody(),
    })
    await new Promise((resolve) => setTimeout(resolve, 25))

    // Second user has their own story; create one against secondCookie.
    const story = await app.inject({
      method: 'POST',
      url: '/my/stories',
      cookies: { [secondCookie.name]: secondCookie.value },
      payload: { name: 'Second User Story' },
    })
    const secondUserStoryId = story.json().story.id

    const second = app.inject({
      method: 'POST',
      url: '/my/images/generate',
      cookies: { [secondCookie.name]: secondCookie.value },
      payload: { ...validBody(), storyId: secondUserStoryId },
    })

    release()
    const [r1, r2] = await Promise.all([first, second])
    expect(r1.statusCode).toBe(200)
    expect(r2.statusCode).toBe(200)
  })
})
