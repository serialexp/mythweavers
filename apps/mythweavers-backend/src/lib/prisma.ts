import { PrismaClient } from '@prisma/client'

export const prisma = new PrismaClient({
  log: process.env.LOG_LEVEL === 'debug' ? ['query', 'error', 'warn'] : ['error'],
})
