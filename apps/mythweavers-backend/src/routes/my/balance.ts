import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { requireAuth } from '../../lib/auth.js'
import { stripe } from '../../lib/stripe.js'

const errorSchema = z.object({ error: z.string() })

const balanceResponseSchema = z.strictObject({
  balance: z.string().meta({
    description: 'User balance as string (Decimal)',
    example: '12.340000',
  }),
})

const topupBodySchema = z.strictObject({
  amount: z.number().positive().max(500).meta({
    description: 'Amount in USD to top up',
    example: 10,
  }),
})

const topupResponseSchema = z.strictObject({
  clientSecret: z.string().meta({
    description: 'Stripe PaymentIntent client secret for the Payment Element',
  }),
})

const balanceRoutes: FastifyPluginAsyncZod = async (fastify) => {
  /**
   * GET /my/balance — return the authenticated user's current balance
   */
  fastify.get(
    '/balance',
    {
      preHandler: requireAuth,
      schema: {
        description: 'Get the current user balance',
        tags: ['balance'],
        response: {
          200: balanceResponseSchema,
          401: errorSchema,
        },
      },
    },
    async (request) => {
      return { balance: request.user!.balance.toString() }
    },
  )

  /**
   * POST /my/balance/topup — create a Stripe PaymentIntent for inline payment
   */
  fastify.post(
    '/balance/topup',
    {
      preHandler: requireAuth,
      schema: {
        description: 'Create a Stripe PaymentIntent for topping up the user balance via Payment Element',
        tags: ['balance'],
        body: topupBodySchema,
        response: {
          200: topupResponseSchema,
          400: errorSchema,
          401: errorSchema,
          503: errorSchema,
        },
      },
    },
    async (request, reply) => {
      if (!stripe) {
        return reply.status(503).send({ error: 'Stripe is not configured' })
      }

      const { amount } = request.body
      const user = request.user!

      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(amount * 100),
        currency: 'usd',
        metadata: {
          userId: String(user.id),
          amount: String(amount),
        },
      })

      if (!paymentIntent.client_secret) {
        return reply.status(400).send({ error: 'Failed to create payment intent' })
      }

      return { clientSecret: paymentIntent.client_secret }
    },
  )
}

export default balanceRoutes
