import { scrypt } from 'node:crypto'
import { promisify } from 'node:util'
import z from 'zod'
import { prisma } from '../prisma.js'
import { publicProcedure } from '../trpc.js'

const scryptAsync = promisify(scrypt)

export const sessionLogin = publicProcedure
  .input(
    z.object({
      email: z.string(),
      password: z.string(),
    }),
  )
  .mutation(async ({ input, ctx }) => {
    const emailUser = await prisma.user.findFirstOrThrow({
      where: {
        email: input.email,
      },
      select: {
        id: true,
        email: true,
        name: true,
        avatarUrl: true,
        password: true,
      },
    })

    const [hashedValue, salt] = emailUser.password.split('.')
    const buf = (await scryptAsync(input.password, salt, 64)) as Buffer

    if (hashedValue === buf.toString('hex')) {
      const newSession = await prisma.session.create({
        data: {
          owner: {
            connect: { id: emailUser.id },
          },
          validUntil: new Date(Date.now() + 1000 * 60 * 60 * 24),
        },
      })
      return {
        token: newSession.id,
        user: {
          id: emailUser.id,
          name: emailUser.name,
          email: emailUser.email,
          avatarUrl: emailUser.avatarUrl,
        },
      }
    }
    return undefined
  })
