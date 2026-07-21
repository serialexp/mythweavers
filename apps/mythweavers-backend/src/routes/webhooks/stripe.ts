import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import type Stripe from 'stripe'
import { z } from 'zod'
import { prisma } from '../../lib/prisma.js'
import { stripe } from '../../lib/stripe.js'

const errorSchema = z.object({ error: z.string() })

export async function creditStripeTopUp(input: {
  paymentIntentId: string
  userId: number
  amount: number
}): Promise<boolean> {
  try {
    await prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({
        where: { id: input.userId },
        data: { balance: { increment: input.amount } },
      })

      await tx.balanceLedger.create({
        data: {
          userId: input.userId,
          amount: input.amount,
          balanceAfter: updated.balance,
          type: 'TOPUP',
          description: `Stripe top-up: $${input.amount.toFixed(2)} (${input.paymentIntentId})`,
          externalId: input.paymentIntentId,
        },
      })
    })
    return true
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002') {
      return false
    }
    throw error
  }
}

const stripeWebhookRoutes: FastifyPluginAsyncZod = async (fastify) => {
  // Override the JSON parser for this plugin scope only — Stripe needs the raw body
  // for signature verification. This does NOT affect any other routes.
  fastify.addContentTypeParser('application/json', { parseAs: 'buffer' }, (_req, body, done) => {
    done(null, body)
  })

  fastify.post(
    '/stripe',
    {
      schema: {
        description: 'Stripe webhook handler — verifies signature and processes events',
        tags: ['webhooks'],
        response: {
          200: z.object({ received: z.literal(true) }),
          400: errorSchema,
          503: errorSchema,
        },
      },
    },
    async (request, reply) => {
      if (!stripe) {
        return reply.status(503).send({ error: 'Stripe is not configured' })
      }

      const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
      if (!webhookSecret) {
        fastify.log.error('[stripe-webhook] STRIPE_WEBHOOK_SECRET not set')
        return reply.status(503).send({ error: 'Webhook secret not configured' })
      }

      const sig = request.headers['stripe-signature']
      if (!sig) {
        return reply.status(400).send({ error: 'Missing stripe-signature header' })
      }

      let event: Stripe.Event
      try {
        event = await stripe.webhooks.constructEventAsync(request.body as Buffer, sig, webhookSecret)
      } catch (err) {
        fastify.log.warn({ err }, '[stripe-webhook] Signature verification failed')
        return reply.status(400).send({ error: 'Webhook signature verification failed' })
      }

      if (event.type === 'payment_intent.succeeded') {
        const paymentIntent = event.data.object as Stripe.PaymentIntent
        const userId = Number(paymentIntent.metadata?.userId)
        const amountInCents = paymentIntent.amount_received
        const amount = amountInCents / 100

        if (
          !Number.isInteger(userId) ||
          userId <= 0 ||
          !Number.isInteger(amountInCents) ||
          amountInCents <= 0 ||
          paymentIntent.currency.toLowerCase() !== 'usd'
        ) {
          fastify.log.warn(
            {
              paymentIntentId: paymentIntent.id,
              userId: paymentIntent.metadata?.userId,
              amountReceived: paymentIntent.amount_received,
              currency: paymentIntent.currency,
            },
            '[stripe-webhook] Invalid payment intent data',
          )
          return reply.status(400).send({ error: 'Invalid payment intent data' })
        }

        const credited = await creditStripeTopUp({
          paymentIntentId: paymentIntent.id,
          userId,
          amount,
        })
        if (credited) {
          fastify.log.info({ userId, amount, paymentIntentId: paymentIntent.id }, '[stripe-webhook] Balance credited')
        } else {
          fastify.log.info({ paymentIntentId: paymentIntent.id }, '[stripe-webhook] PaymentIntent already credited')
        }
      }

      return { received: true as const }
    },
  )
}

export default stripeWebhookRoutes
