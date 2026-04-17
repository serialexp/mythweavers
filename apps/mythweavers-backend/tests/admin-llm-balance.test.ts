import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import type { FastifyInstance } from 'fastify'
import { prisma } from '../src/lib/prisma.js'
import { syncProviderCosts } from '../src/lib/provider-costs.js'
import { buildApp, cleanDatabase } from './helpers.js'

describe('Admin LLM Balance Endpoints', () => {
  let app: FastifyInstance
  let adminCookie: string
  let providerId: string

  beforeEach(async () => {
    app = await buildApp()
    await cleanDatabase()

    // Clean up LLM-specific tables
    await prisma.llmProviderTransaction.deleteMany()
    await prisma.llmModel.deleteMany()
    await prisma.llmProvider.deleteMany()

    // Create an admin user and get a session cookie
    const registerRes = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: {
        email: 'admin@example.com',
        username: 'adminuser',
        password: 'password123',
      },
    })
    adminCookie = registerRes.cookies[0].value

    // Promote to admin
    await prisma.user.updateMany({
      where: { email: 'admin@example.com' },
      data: { role: 'admin' },
    })

    // Create a test provider
    const provider = await prisma.llmProvider.create({
      data: {
        name: 'test-anthropic',
        displayName: 'Test Anthropic',
        endpointUrl: 'https://api.anthropic.com',
        protocol: 'ANTHROPIC',
        envKeyName: 'LLM_TEST_API_KEY',
        enabled: true,
      },
    })
    providerId = provider.id
  })

  afterEach(async () => {
    await app.close()
  })

  // --- GET /admin/llm/providers/:providerId/balance ---

  describe('GET /admin/llm/providers/:providerId/balance', () => {
    test('should return zero balance for a provider with no transactions', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/admin/llm/providers/${providerId}/balance`,
        cookies: { sessionToken: adminCookie },
      })

      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.balance.providerId).toBe(providerId)
      expect(body.balance.totalTopUps).toBe('0.000000')
      expect(body.balance.totalCosts).toBe('0.000000')
      expect(body.balance.balance).toBe('0.000000')
    })

    test('should compute balance from top-ups and costs', async () => {
      // Add some transactions
      await prisma.llmProviderTransaction.createMany({
        data: [
          {
            providerId,
            type: 'TOP_UP',
            amount: 100,
            date: new Date('2026-04-01'),
            notes: 'Initial top-up',
          },
          {
            providerId,
            type: 'COST_SYNC',
            amount: 23.5,
            date: new Date('2026-04-05'),
            syncKey: 'test:2026-04-05',
          },
          {
            providerId,
            type: 'TOP_UP',
            amount: 50,
            date: new Date('2026-04-10'),
            notes: 'Second top-up',
          },
        ],
      })

      const res = await app.inject({
        method: 'GET',
        url: `/admin/llm/providers/${providerId}/balance`,
        cookies: { sessionToken: adminCookie },
      })

      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.balance.totalTopUps).toBe('150.000000')
      expect(body.balance.totalCosts).toBe('23.500000')
      expect(body.balance.balance).toBe('126.500000')
    })

    test('should return 404 for non-existent provider', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/admin/llm/providers/nonexistent/balance',
        cookies: { sessionToken: adminCookie },
      })

      expect(res.statusCode).toBe(404)
    })

    test('should return 401 without auth', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/admin/llm/providers/${providerId}/balance`,
      })

      expect(res.statusCode).toBe(401)
    })

    test('should return 403 for non-admin user', async () => {
      // Register a regular user
      const regularRes = await app.inject({
        method: 'POST',
        url: '/auth/register',
        payload: {
          email: 'regular@example.com',
          username: 'regularuser',
          password: 'password123',
        },
      })
      const regularCookie = regularRes.cookies[0].value

      const res = await app.inject({
        method: 'GET',
        url: `/admin/llm/providers/${providerId}/balance`,
        cookies: { sessionToken: regularCookie },
      })

      expect(res.statusCode).toBe(403)
    })
  })

  // --- GET /admin/llm/providers/:providerId/transactions ---

  describe('GET /admin/llm/providers/:providerId/transactions', () => {
    test('should return empty list for provider with no transactions', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/admin/llm/providers/${providerId}/transactions`,
        cookies: { sessionToken: adminCookie },
      })

      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.transactions).toHaveLength(0)
      expect(body.pagination.total).toBe(0)
    })

    test('should return paginated transactions ordered by date desc', async () => {
      // Create 5 transactions
      for (let i = 1; i <= 5; i++) {
        await prisma.llmProviderTransaction.create({
          data: {
            providerId,
            type: i % 2 === 0 ? 'COST_SYNC' : 'TOP_UP',
            amount: i * 10,
            date: new Date(`2026-04-${String(i).padStart(2, '0')}`),
            notes: `Transaction ${i}`,
            ...(i % 2 === 0 ? { syncKey: `test:2026-04-${String(i).padStart(2, '0')}` } : {}),
          },
        })
      }

      // Get first page of 2
      const res = await app.inject({
        method: 'GET',
        url: `/admin/llm/providers/${providerId}/transactions?page=1&pageSize=2`,
        cookies: { sessionToken: adminCookie },
      })

      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.transactions).toHaveLength(2)
      expect(body.pagination.total).toBe(5)
      expect(body.pagination.page).toBe(1)
      expect(body.pagination.pageSize).toBe(2)

      // Should be most recent first
      expect(body.transactions[0].notes).toBe('Transaction 5')
      expect(body.transactions[1].notes).toBe('Transaction 4')
    })

    test('should return 404 for non-existent provider', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/admin/llm/providers/nonexistent/transactions',
        cookies: { sessionToken: adminCookie },
      })

      expect(res.statusCode).toBe(404)
    })
  })

  // --- POST /admin/llm/providers/:providerId/top-up ---

  describe('POST /admin/llm/providers/:providerId/top-up', () => {
    test('should create a top-up transaction', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/admin/llm/providers/${providerId}/top-up`,
        cookies: { sessionToken: adminCookie },
        payload: {
          amount: 100,
          notes: 'April top-up',
        },
      })

      expect(res.statusCode).toBe(201)
      const body = res.json()
      expect(body.transaction.type).toBe('TOP_UP')
      expect(body.transaction.amount).toBe('100')
      expect(body.transaction.notes).toBe('April top-up')
      expect(body.transaction.providerId).toBe(providerId)
    })

    test('should create a top-up with a specific date', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/admin/llm/providers/${providerId}/top-up`,
        cookies: { sessionToken: adminCookie },
        payload: {
          amount: 50,
          date: '2026-04-01T00:00:00.000Z',
          notes: 'Backdated top-up',
        },
      })

      expect(res.statusCode).toBe(201)
      const body = res.json()
      expect(body.transaction.date).toContain('2026-04-01')
    })

    test('should reject negative amounts', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/admin/llm/providers/${providerId}/top-up`,
        cookies: { sessionToken: adminCookie },
        payload: {
          amount: -50,
        },
      })

      expect(res.statusCode).toBe(400)
    })

    test('should reject zero amount', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/admin/llm/providers/${providerId}/top-up`,
        cookies: { sessionToken: adminCookie },
        payload: {
          amount: 0,
        },
      })

      expect(res.statusCode).toBe(400)
    })

    test('should return 404 for non-existent provider', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/admin/llm/providers/nonexistent/top-up',
        cookies: { sessionToken: adminCookie },
        payload: {
          amount: 100,
        },
      })

      expect(res.statusCode).toBe(404)
    })

    test('should update balance after top-up', async () => {
      // Add a top-up
      await app.inject({
        method: 'POST',
        url: `/admin/llm/providers/${providerId}/top-up`,
        cookies: { sessionToken: adminCookie },
        payload: { amount: 75.50 },
      })

      // Check balance
      const balanceRes = await app.inject({
        method: 'GET',
        url: `/admin/llm/providers/${providerId}/balance`,
        cookies: { sessionToken: adminCookie },
      })

      expect(balanceRes.statusCode).toBe(200)
      const body = balanceRes.json()
      expect(body.balance.totalTopUps).toBe('75.500000')
      expect(body.balance.balance).toBe('75.500000')
    })
  })

  // --- POST /admin/llm/providers/:providerId/sync-costs ---

  describe('POST /admin/llm/providers/:providerId/sync-costs', () => {
    test('should return 400 for Cloudflare provider', async () => {
      const cfProvider = await prisma.llmProvider.create({
        data: {
          name: 'test-cloudflare',
          displayName: 'Test Cloudflare',
          endpointUrl: 'https://api.cloudflare.com',
          protocol: 'CLOUDFLARE',
          envKeyName: 'LLM_CF_KEY',
          enabled: true,
        },
      })

      const res = await app.inject({
        method: 'POST',
        url: `/admin/llm/providers/${cfProvider.id}/sync-costs`,
        cookies: { sessionToken: adminCookie },
        payload: {
          startDate: '2026-04-01',
          endDate: '2026-04-13',
        },
      })

      expect(res.statusCode).toBe(400)
      expect(res.json().error).toContain('Cloudflare')
    })

    test('should return 502 when no API key is available', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/admin/llm/providers/${providerId}/sync-costs`,
        cookies: { sessionToken: adminCookie },
        payload: {
          startDate: '2026-04-01',
          endDate: '2026-04-13',
        },
      })

      // No API key env var set, should get 502
      expect(res.statusCode).toBe(502)
    })

    test('should return 404 for non-existent provider', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/admin/llm/providers/nonexistent/sync-costs',
        cookies: { sessionToken: adminCookie },
        payload: {
          startDate: '2026-04-01',
          endDate: '2026-04-13',
        },
      })

      expect(res.statusCode).toBe(404)
    })
  })

  // --- syncProviderCosts upsert logic ---

  describe('syncProviderCosts (upsert)', () => {
    test('should create new cost records', async () => {
      const result = await syncProviderCosts(providerId, 'test-anthropic', [
        { date: '2026-04-10', amount: 5.25 },
        { date: '2026-04-11', amount: 3.10 },
      ])

      expect(result.synced).toBe(2)
      expect(result.updated).toBe(0)
      expect(result.totalCost).toBeCloseTo(8.35)

      // Verify records exist
      const txns = await prisma.llmProviderTransaction.findMany({
        where: { providerId },
        orderBy: { date: 'asc' },
      })
      expect(txns).toHaveLength(2)
      expect(txns[0].syncKey).toBe('test-anthropic:2026-04-10')
      expect(txns[0].amount.toNumber()).toBe(5.25)
    })

    test('should update existing records when amount changes', async () => {
      // First sync
      await syncProviderCosts(providerId, 'test-anthropic', [
        { date: '2026-04-10', amount: 5.25 },
      ])

      // Second sync with updated amount (cost grew during the day)
      const result = await syncProviderCosts(providerId, 'test-anthropic', [
        { date: '2026-04-10', amount: 8.50 },
      ])

      expect(result.synced).toBe(0)
      expect(result.updated).toBe(1)

      // Verify amount was updated, not duplicated
      const txns = await prisma.llmProviderTransaction.findMany({
        where: { providerId, syncKey: 'test-anthropic:2026-04-10' },
      })
      expect(txns).toHaveLength(1)
      expect(txns[0].amount.toNumber()).toBe(8.50)
    })

    test('should not update when amount is unchanged', async () => {
      await syncProviderCosts(providerId, 'test-anthropic', [
        { date: '2026-04-10', amount: 5.25 },
      ])

      const result = await syncProviderCosts(providerId, 'test-anthropic', [
        { date: '2026-04-10', amount: 5.25 },
      ])

      expect(result.synced).toBe(0)
      expect(result.updated).toBe(0)
    })

    test('should skip zero-amount costs', async () => {
      const result = await syncProviderCosts(providerId, 'test-anthropic', [
        { date: '2026-04-10', amount: 0 },
        { date: '2026-04-11', amount: 3.10 },
      ])

      expect(result.synced).toBe(1)
      expect(result.updated).toBe(0)
    })

    test('should correctly update balance after re-sync', async () => {
      // Add a top-up
      await prisma.llmProviderTransaction.create({
        data: {
          providerId,
          type: 'TOP_UP',
          amount: 100,
          date: new Date('2026-04-01'),
        },
      })

      // First sync
      await syncProviderCosts(providerId, 'test-anthropic', [
        { date: '2026-04-10', amount: 5.00 },
      ])

      // Check balance
      let balanceRes = await app.inject({
        method: 'GET',
        url: `/admin/llm/providers/${providerId}/balance`,
        cookies: { sessionToken: adminCookie },
      })
      expect(balanceRes.json().balance.balance).toBe('95.000000')

      // Re-sync with updated cost
      await syncProviderCosts(providerId, 'test-anthropic', [
        { date: '2026-04-10', amount: 12.00 },
      ])

      // Balance should reflect the updated cost
      balanceRes = await app.inject({
        method: 'GET',
        url: `/admin/llm/providers/${providerId}/balance`,
        cookies: { sessionToken: adminCookie },
      })
      expect(balanceRes.json().balance.balance).toBe('88.000000')
    })
  })
})
