import { beforeEach, describe, expect, test } from 'bun:test'
import { prisma } from '../src/lib/prisma.js'
import { creditStripeTopUp } from '../src/routes/webhooks/stripe.js'
import { cleanDatabase } from './helpers.js'

describe('Stripe top-up idempotency', () => {
  beforeEach(async () => {
    await cleanDatabase()
  })

  test('concurrent delivery credits a PaymentIntent exactly once', async () => {
    const user = await prisma.user.create({
      data: {
        email: 'stripe@example.com',
        username: 'stripeuser',
        passwordHash: 'unused:unused',
      },
    })

    const results = await Promise.all([
      creditStripeTopUp({ paymentIntentId: 'pi_duplicate', userId: user.id, amount: 10 }),
      creditStripeTopUp({ paymentIntentId: 'pi_duplicate', userId: user.id, amount: 10 }),
    ])

    expect(results.filter(Boolean)).toHaveLength(1)
    const updated = await prisma.user.findUniqueOrThrow({ where: { id: user.id } })
    expect(Number(updated.balance)).toBe(10)
    expect(await prisma.balanceLedger.count({ where: { externalId: 'pi_duplicate' } })).toBe(1)
  })
})
