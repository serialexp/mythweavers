import { test } from 'bun:test'
import { prisma } from '../src/lib/prisma.js'
import { buildApp, cleanDatabase } from './helpers.js'

test('debug message schema', async () => {
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
  const story = await app.inject({
    method: 'POST',
    url: '/my/stories',
    cookies: { [sessionCookie.name]: sessionCookie.value },
    payload: { name: 'Test' },
  })
  const storyId = story.json().story.id

  const book = await app.inject({
    method: 'POST',
    url: `/my/stories/${storyId}/books`,
    cookies: { [sessionCookie.name]: sessionCookie.value },
    payload: { name: 'Book' },
  })
  const bookId = book.json().book.id

  const arc = await app.inject({
    method: 'POST',
    url: `/my/books/${bookId}/arcs`,
    cookies: { [sessionCookie.name]: sessionCookie.value },
    payload: { name: 'Arc' },
  })
  const arcId = arc.json().arc.id

  const chapter = await app.inject({
    method: 'POST',
    url: `/my/arcs/${arcId}/chapters`,
    cookies: { [sessionCookie.name]: sessionCookie.value },
    payload: { name: 'Chapter' },
  })
  const chapterId = chapter.json().chapter.id

  const scene = await app.inject({
    method: 'POST',
    url: `/my/chapters/${chapterId}/scenes`,
    cookies: { [sessionCookie.name]: sessionCookie.value },
    payload: { name: 'Scene' },
  })
  const sceneId = scene.json().scene.id

  // Create directly with Prisma to see actual structure
  const message = await prisma.message.create({
    data: {
      sceneId,
      sortOrder: 0,
      instruction: null,
      script: null,
      messageRevisions: {
        create: {
          version: 1,
        },
      },
    },
    include: {
      messageRevisions: true,
    },
  })

  console.log('\n=== PRISMA DIRECT CREATE ===')
  console.log(JSON.stringify(message, null, 2))
  console.log('\nField types:')
  console.log('- createdAt type:', typeof message.createdAt)
  console.log('- createdAt value:', message.createdAt)
  console.log('- updatedAt type:', typeof message.updatedAt)
  console.log('- updatedAt value:', message.updatedAt)

  await app.close()
})
