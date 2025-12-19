import { randomBytes, scrypt } from 'node:crypto'
import { promisify } from 'node:util'
import { TRPCError } from '@trpc/server'
import z from 'zod'
import { prisma } from '../prisma.js'
import { publicProcedure } from '../trpc.js'

const scryptAsync = promisify(scrypt)

export const login = publicProcedure
  .input(
    z.object({
      email: z.string(),
      password: z.string(),
      description: z.string().optional(),
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
      const newAccessKey = await prisma.accessKey.create({
        data: {
          key: randomBytes(64).toString('hex'),
          description: input.description,
          owner: {
            connect: { id: emailUser.id },
          },
        },
      })
      return {
        token: newAccessKey.key,
        user: {
          id: emailUser.id,
          name: emailUser.name,
          email: emailUser.email,
          avatarUrl: emailUser.avatarUrl,
        },
      }
    }
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'Invalid email or password',
    })
  })
