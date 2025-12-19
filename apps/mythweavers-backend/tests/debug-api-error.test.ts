import { test } from 'bun:test'
import { buildApp, cleanDatabase } from './helpers.js'

test('trigger API validation error', async () => {
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

  // This should fail with validation error
  const messageResponse = await app.inject({
    method: 'POST',
    url: `/my/scenes/${sceneId}/messages`,
    cookies: { [sessionCookie.name]: sessionCookie.value },
    payload: {},
  })

  console.log('\n=== API ERROR ===')
  console.log('Status:', messageResponse.statusCode)
  console.log('Body:', messageResponse.body)

  await app.close()
})
