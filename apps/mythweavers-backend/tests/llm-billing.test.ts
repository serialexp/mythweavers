import { beforeEach, describe, expect, test } from 'bun:test'
import { prisma } from '../src/lib/prisma.js'
import { reserveLlmCredit } from '../src/routes/my/llm.js'
import { cleanDatabase } from './helpers.js'

describe('LLM balance reservations', () => {
  beforeEach(async () => {
    await cleanDatabase()
  })

  test('concurrent reservations cannot collectively exceed the balance', async () => {
    const user = await prisma.user.create({
      data: {
        email: 'llm@example.com',
        username: 'llmuser',
        passwordHash: 'unused:unused',
        balance: 1,
      },
    })

    const reservations = await Promise.all([
      reserveLlmCredit(user.id, 'test-model', 0.75),
      reserveLlmCredit(user.id, 'test-model', 0.75),
    ])

    expect(reservations.filter(Boolean)).toHaveLength(1)
    const updated = await prisma.user.findUniqueOrThrow({ where: { id: user.id } })
    expect(Number(updated.balance)).toBe(0.25)
    expect(await prisma.balanceLedger.count({ where: { userId: user.id } })).toBe(1)
  })
})
