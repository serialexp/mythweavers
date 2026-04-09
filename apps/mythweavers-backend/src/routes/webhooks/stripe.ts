import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { z } from 'zod'
import type Stripe from 'stripe'
import { stripe } from '../../lib/stripe.js'
import { prisma } from '../../lib/prisma.js'

const errorSchema = z.object({ error: z.string() })

const stripeWebhookRoutes: FastifyPluginAsyncZod = async (fastify) => {
  // Override the JSON parser for this plugin scope only — Stripe needs the raw body
  // for signature verification. This does NOT affect any other routes.
  fastify.addContentTypeParser(
    'application/json',
    { parseAs: 'buffer' },
    (_req, body, done) => {
      done(null, body)
    },
  )

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
        event = await stripe.webhooks.constructEventAsync(
          request.body as Buffer,
          sig,
          webhookSecret,
        )
      } catch (err) {
        fastify.log.warn({ err }, '[stripe-webhook] Signature verification failed')
        return reply.status(400).send({ error: 'Webhook signature verification failed' })
      }

      if (event.type === 'payment_intent.succeeded') {
        const paymentIntent = event.data.object as Stripe.PaymentIntent
        const userId = Number(paymentIntent.metadata?.userId)
        const amount = Number(paymentIntent.metadata?.amount)

        if (!userId || !amount || amount <= 0) {
          fastify.log.warn({ metadata: paymentIntent.metadata }, '[stripe-webhook] Invalid payment intent metadata')
          return reply.status(400).send({ error: 'Invalid payment intent metadata' })
        }

        // Idempotency: check if we already processed this payment intent
        const existingEntry = await prisma.balanceLedger.findFirst({
          where: {
            userId,
            type: 'TOPUP',
            description: { contains: paymentIntent.id },
          },
        })

        if (!existingEntry) {
          await prisma.$transaction(async (tx) => {
            const updated = await tx.user.update({
              where: { id: userId },
              data: { balance: { increment: amount } },
            })

            await tx.balanceLedger.create({
              data: {
                userId,
                amount,
                balanceAfter: updated.balance,
                type: 'TOPUP',
                description: `Stripe top-up: $${amount.toFixed(2)} (${paymentIntent.id})`,
              },
            })
          })

          fastify.log.info(
            { userId, amount, paymentIntentId: paymentIntent.id },
            '[stripe-webhook] Balance credited',
          )
        }
      }

      return { received: true as const }
    },
  )
}

export default stripeWebhookRoutes
