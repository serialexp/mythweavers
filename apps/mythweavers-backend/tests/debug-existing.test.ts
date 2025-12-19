import { test } from 'bun:test'
import { prisma } from '../src/lib/prisma.js'
import { buildApp, cleanDatabase } from './helpers.js'

test('debug existing story endpoint', async () => {
  const app = await buildApp()
  await cleanDatabase()

  const registerResponse = await app.inject({
    method: 'POST',
    url: '/auth/register',
    payload: {
      email: 'test@example.com',
      username: 'testuser',
      password: 'password123',
    },
  })

  const sessionCookie = registerResponse.cookies[0]
  const userId = registerResponse.json().user.id

  // Create story directly with Prisma
  const storyDirect = await prisma.story.create({
    data: {
      name: 'Direct Story',
      ownerId: userId,
    },
  })

  console.log('\n=== STORY FROM PRISMA ===')
  console.log('createdAt type:', typeof storyDirect.createdAt)
  console.log('createdAt value:', storyDirect.createdAt)

  // Create story via API
  const storyResponse = await app.inject({
    method: 'POST',
    url: '/my/stories',
    cookies: { [sessionCookie.name]: sessionCookie.value },
    payload: { name: 'API Story' },
  })

  console.log('\n=== STORY FROM API ===')
  console.log('Status:', storyResponse.statusCode)
  console.log('Body:', storyResponse.body)

  await app.close()
})
