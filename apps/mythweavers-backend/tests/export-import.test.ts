import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test'
import { promises as fs } from 'node:fs'
import { join } from 'node:path'
import type { FastifyInstance } from 'fastify'
import FormData from 'form-data'
import sharp from 'sharp'
import unzipper from 'unzipper'
import { getUploadDir } from '../src/lib/file-storage.js'
import { prisma } from '../src/lib/prisma.js'
import { buildApp, cleanDatabase } from './helpers.js'

let app: FastifyInstance
let sessionCookie: { name: string; value: string }
let userId: number

// Test image paths
const testImagesDir = join(import.meta.dir, 'fixtures')
const testImagePath = join(testImagesDir, 'test-export-image.png')

beforeAll(async () => {
  app = await buildApp()
  await app.ready()

  // Create test images directory
  await fs.mkdir(testImagesDir, { recursive: true })

  // Create a test PNG image
  await sharp({
    create: {
      width: 50,
      height: 50,
      channels: 4,
      background: { r: 100, g: 150, b: 200, alpha: 1 },
    },
  })
    .png()
    .toFile(testImagePath)
})

afterAll(async () => {
  await app.close()

  // Clean up test images
  await fs.rm(testImagesDir, { recursive: true, force: true })

  // Clean up uploads directory
  const uploadsDir = getUploadDir()
  await fs.rm(uploadsDir, { recursive: true, force: true })
})

beforeEach(async () => {
  await cleanDatabase()

  // Register and login a user
  const registerResponse = await app.inject({
    method: 'POST',
    url: '/auth/register',
    payload: {
      username: 'testuser',
      email: 'test@example.com',
      password: 'password123',
    },
  })

  const body = registerResponse.json()
  userId = body.user.id
  sessionCookie = registerResponse.cookies[0]
})

describe('Story Export/Import', () => {
  describe('GET /my/stories/:storyId/export-zip', () => {
    test('should export an empty story as ZIP', async () => {
      // Create a story
      const createResponse = await app.inject({
        method: 'POST',
        url: '/my/stories',
        cookies: { [sessionCookie.name]: sessionCookie.value },
        payload: {
          name: 'Test Story',
          summary: 'A test story for export',
        },
      })
      const storyId = createResponse.json().story.id

      // Export the story
      const exportResponse = await app.inject({
        method: 'GET',
        url: `/my/stories/${storyId}/export-zip`,
        cookies: { [sessionCookie.name]: sessionCookie.value },
      })

      expect(exportResponse.statusCode).toBe(200)
      expect(exportResponse.headers['content-type']).toBe('application/zip')
      expect(exportResponse.headers['content-disposition']).toContain('story-export')

      // Parse the ZIP
      const zipBuffer = exportResponse.rawPayload
      const directory = await unzipper.Open.buffer(zipBuffer)

      // Verify ZIP structure
      const fileNames = directory.files.map((f) => f.path)
      expect(fileNames).toContain('manifest.json')
      expect(fileNames).toContain('story.json')

      // Verify manifest
      const manifestFile = directory.files.find((f) => f.path === 'manifest.json')
      const manifestBuffer = await manifestFile!.buffer()
      const manifest = JSON.parse(manifestBuffer.toString('utf-8'))

      expect(manifest.version).toBe('1.0.0')
      expect(manifest.storyId).toBe(storyId)
      expect(manifest.storyName).toBe('Test Story')
      expect(manifest.checksum).toBeDefined()

      // Verify story data
      const storyFile = directory.files.find((f) => f.path === 'story.json')
      const storyBuffer = await storyFile!.buffer()
      const storyData = JSON.parse(storyBuffer.toString('utf-8'))

      expect(storyData.story.name).toBe('Test Story')
      expect(storyData.story.summary).toBe('A test story for export')
      expect(storyData.books).toEqual([])
      expect(storyData.characters).toEqual([])
    })

    test('should export story with content hierarchy', async () => {
      // Create a story
      const createResponse = await app.inject({
        method: 'POST',
        url: '/my/stories',
        cookies: { [sessionCookie.name]: sessionCookie.value },
        payload: { name: 'Story with Content' },
      })
      const storyId = createResponse.json().story.id

      // Create a book
      const bookResponse = await app.inject({
        method: 'POST',
        url: `/my/stories/${storyId}/books`,
        cookies: { [sessionCookie.name]: sessionCookie.value },
        payload: { name: 'Book 1' },
      })
      const bookId = bookResponse.json().book.id

      // Create an arc
      const arcResponse = await app.inject({
        method: 'POST',
        url: `/my/books/${bookId}/arcs`,
        cookies: { [sessionCookie.name]: sessionCookie.value },
        payload: { name: 'Arc 1' },
      })
      const arcId = arcResponse.json().arc.id

      // Create a chapter
      const chapterResponse = await app.inject({
        method: 'POST',
        url: `/my/arcs/${arcId}/chapters`,
        cookies: { [sessionCookie.name]: sessionCookie.value },
        payload: { name: 'Chapter 1' },
      })
      const chapterId = chapterResponse.json().chapter.id

      // Create a scene
      const sceneResponse = await app.inject({
        method: 'POST',
        url: `/my/chapters/${chapterId}/scenes`,
        cookies: { [sessionCookie.name]: sessionCookie.value },
        payload: { name: 'Scene 1' },
      })
      const sceneId = sceneResponse.json().scene.id

      // Create a character
      const characterResponse = await app.inject({
        method: 'POST',
        url: `/my/stories/${storyId}/characters`,
        cookies: { [sessionCookie.name]: sessionCookie.value },
        payload: {
          firstName: 'John',
          lastName: 'Doe',
          description: 'A test character',
        },
      })
      const characterId = characterResponse.json().character.id

      // Create a context item
      const contextItemResponse = await app.inject({
        method: 'POST',
        url: `/my/stories/${storyId}/context-items`,
        cookies: { [sessionCookie.name]: sessionCookie.value },
        payload: {
          type: 'location',
          name: 'Test Location',
          description: 'A test location',
        },
      })
      const contextItemId = contextItemResponse.json().contextItem.id

      // Export the story
      const exportResponse = await app.inject({
        method: 'GET',
        url: `/my/stories/${storyId}/export-zip`,
        cookies: { [sessionCookie.name]: sessionCookie.value },
      })

      expect(exportResponse.statusCode).toBe(200)

      // Parse and verify
      const zipBuffer = exportResponse.rawPayload
      const directory = await unzipper.Open.buffer(zipBuffer)
      const storyFile = directory.files.find((f) => f.path === 'story.json')
      const storyBuffer = await storyFile!.buffer()
      const storyData = JSON.parse(storyBuffer.toString('utf-8'))

      // Verify books
      expect(storyData.books).toHaveLength(1)
      expect(storyData.books[0].id).toBe(bookId)
      expect(storyData.books[0].name).toBe('Book 1')

      // Verify arcs
      expect(storyData.books[0].arcs).toHaveLength(1)
      expect(storyData.books[0].arcs[0].id).toBe(arcId)

      // Verify chapters
      expect(storyData.books[0].arcs[0].chapters).toHaveLength(1)
      expect(storyData.books[0].arcs[0].chapters[0].id).toBe(chapterId)

      // Verify scenes
      expect(storyData.books[0].arcs[0].chapters[0].scenes).toHaveLength(1)
      expect(storyData.books[0].arcs[0].chapters[0].scenes[0].id).toBe(sceneId)

      // Verify characters
      expect(storyData.characters).toHaveLength(1)
      expect(storyData.characters[0].id).toBe(characterId)
      expect(storyData.characters[0].firstName).toBe('John')

      // Verify context items
      expect(storyData.contextItems).toHaveLength(1)
      expect(storyData.contextItems[0].id).toBe(contextItemId)
    })

    test('should return 404 for non-existent story', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/my/stories/nonexistent/export-zip',
        cookies: { [sessionCookie.name]: sessionCookie.value },
      })

      expect(response.statusCode).toBe(404)
    })

    test('should return 401 without authentication', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/my/stories/someid/export-zip',
      })

      expect(response.statusCode).toBe(401)
    })

    test('should not export other user story', async () => {
      // Create a story with first user
      const createResponse = await app.inject({
        method: 'POST',
        url: '/my/stories',
        cookies: { [sessionCookie.name]: sessionCookie.value },
        payload: { name: 'Private Story' },
      })
      const storyId = createResponse.json().story.id

      // Create another user
      const registerResponse = await app.inject({
        method: 'POST',
        url: '/auth/register',
        payload: {
          username: 'otheruser',
          email: 'other@example.com',
          password: 'password123',
        },
      })
      const otherSessionCookie = registerResponse.cookies[0]

      // Try to export with other user
      const response = await app.inject({
        method: 'GET',
        url: `/my/stories/${storyId}/export-zip`,
        cookies: { [otherSessionCookie.name]: otherSessionCookie.value },
      })

      expect(response.statusCode).toBe(404)
    })
  })

  describe('POST /my/stories/import-zip', () => {
    test('should import a story from ZIP', async () => {
      // First, create and export a story
      const createResponse = await app.inject({
        method: 'POST',
        url: '/my/stories',
        cookies: { [sessionCookie.name]: sessionCookie.value },
        payload: {
          name: 'Story to Export',
          summary: 'Will be imported',
          genre: 'fantasy',
        },
      })
      const originalStoryId = createResponse.json().story.id

      // Create a character
      await app.inject({
        method: 'POST',
        url: `/my/stories/${originalStoryId}/characters`,
        cookies: { [sessionCookie.name]: sessionCookie.value },
        payload: {
          firstName: 'Alice',
          lastName: 'Smith',
          description: 'The protagonist',
        },
      })

      // Export the story
      const exportResponse = await app.inject({
        method: 'GET',
        url: `/my/stories/${originalStoryId}/export-zip`,
        cookies: { [sessionCookie.name]: sessionCookie.value },
      })

      const zipBuffer = exportResponse.rawPayload

      // Import the story
      const form = new FormData()
      form.append('file', zipBuffer, {
        filename: 'story-export.zip',
        contentType: 'application/zip',
      })

      const importResponse = await app.inject({
        method: 'POST',
        url: '/my/stories/import-zip',
        headers: { ...form.getHeaders() },
        payload: form,
        cookies: { [sessionCookie.name]: sessionCookie.value },
      })

      expect(importResponse.statusCode).toBe(201)
      const importBody = importResponse.json()
      expect(importBody.success).toBe(true)
      expect(importBody.storyId).toBeDefined()
      expect(importBody.storyName).toBe('Story to Export')

      // Verify the imported story is different from original
      expect(importBody.storyId).not.toBe(originalStoryId)

      // Verify the imported story exists
      const getResponse = await app.inject({
        method: 'GET',
        url: `/my/stories/${importBody.storyId}`,
        cookies: { [sessionCookie.name]: sessionCookie.value },
      })

      expect(getResponse.statusCode).toBe(200)
      const importedStory = getResponse.json().story
      expect(importedStory.name).toBe('Story to Export')
      expect(importedStory.summary).toBe('Will be imported')
      expect(importedStory.genre).toBe('fantasy')
      expect(importedStory.published).toBe(false) // Should always start unpublished

      // Verify character was imported
      const characters = await prisma.character.findMany({
        where: { storyId: importBody.storyId },
      })
      expect(characters).toHaveLength(1)
      expect(characters[0].firstName).toBe('Alice')
      expect(characters[0].lastName).toBe('Smith')
    })

    test('should import story with full content hierarchy', async () => {
      // Create a story with full hierarchy
      const createResponse = await app.inject({
        method: 'POST',
        url: '/my/stories',
        cookies: { [sessionCookie.name]: sessionCookie.value },
        payload: { name: 'Full Story' },
      })
      const originalStoryId = createResponse.json().story.id

      // Create book
      const bookResponse = await app.inject({
        method: 'POST',
        url: `/my/stories/${originalStoryId}/books`,
        cookies: { [sessionCookie.name]: sessionCookie.value },
        payload: { name: 'Book Alpha' },
      })
      const bookId = bookResponse.json().book.id

      // Create arc
      const arcResponse = await app.inject({
        method: 'POST',
        url: `/my/books/${bookId}/arcs`,
        cookies: { [sessionCookie.name]: sessionCookie.value },
        payload: { name: 'Arc Alpha' },
      })
      const arcId = arcResponse.json().arc.id

      // Create chapter
      const chapterResponse = await app.inject({
        method: 'POST',
        url: `/my/arcs/${arcId}/chapters`,
        cookies: { [sessionCookie.name]: sessionCookie.value },
        payload: { name: 'Chapter Alpha' },
      })
      const chapterId = chapterResponse.json().chapter.id

      // Create scene
      await app.inject({
        method: 'POST',
        url: `/my/chapters/${chapterId}/scenes`,
        cookies: { [sessionCookie.name]: sessionCookie.value },
        payload: { name: 'Scene Alpha' },
      })

      // Export
      const exportResponse = await app.inject({
        method: 'GET',
        url: `/my/stories/${originalStoryId}/export-zip`,
        cookies: { [sessionCookie.name]: sessionCookie.value },
      })

      const zipBuffer = exportResponse.rawPayload

      // Import
      const form = new FormData()
      form.append('file', zipBuffer, {
        filename: 'story-export.zip',
        contentType: 'application/zip',
      })

      const importResponse = await app.inject({
        method: 'POST',
        url: '/my/stories/import-zip',
        headers: { ...form.getHeaders() },
        payload: form,
        cookies: { [sessionCookie.name]: sessionCookie.value },
      })

      expect(importResponse.statusCode).toBe(201)
      const { storyId: importedStoryId } = importResponse.json()

      // Verify the full hierarchy was imported
      const importedBooks = await prisma.book.findMany({
        where: { storyId: importedStoryId },
        include: {
          arcs: {
            include: {
              chapters: {
                include: {
                  scenes: true,
                },
              },
            },
          },
        },
      })

      expect(importedBooks).toHaveLength(1)
      expect(importedBooks[0].name).toBe('Book Alpha')
      expect(importedBooks[0].arcs).toHaveLength(1)
      expect(importedBooks[0].arcs[0].name).toBe('Arc Alpha')
      expect(importedBooks[0].arcs[0].chapters).toHaveLength(1)
      expect(importedBooks[0].arcs[0].chapters[0].name).toBe('Chapter Alpha')
      expect(importedBooks[0].arcs[0].chapters[0].scenes).toHaveLength(1)
      expect(importedBooks[0].arcs[0].chapters[0].scenes[0].name).toBe('Scene Alpha')
    })

    test('should return 400 for invalid ZIP', async () => {
      const form = new FormData()
      form.append('file', Buffer.from('not a zip file'), {
        filename: 'invalid.zip',
        contentType: 'application/zip',
      })

      const response = await app.inject({
        method: 'POST',
        url: '/my/stories/import-zip',
        headers: { ...form.getHeaders() },
        payload: form,
        cookies: { [sessionCookie.name]: sessionCookie.value },
      })

      expect(response.statusCode).toBe(400)
    })

    test('should return 400 for no file', async () => {
      const form = new FormData()

      const response = await app.inject({
        method: 'POST',
        url: '/my/stories/import-zip',
        headers: { ...form.getHeaders() },
        payload: form,
        cookies: { [sessionCookie.name]: sessionCookie.value },
      })

      expect(response.statusCode).toBe(400)
      expect(response.json().error).toContain('No file')
    })

    test('should return 401 without authentication', async () => {
      const form = new FormData()
      form.append('file', Buffer.from('data'), {
        filename: 'story.zip',
        contentType: 'application/zip',
      })

      const response = await app.inject({
        method: 'POST',
        url: '/my/stories/import-zip',
        headers: { ...form.getHeaders() },
        payload: form,
      })

      expect(response.statusCode).toBe(401)
    })

    test('should import a story from JSON bundle', async () => {
      // Create a story
      const createResponse = await app.inject({
        method: 'POST',
        url: '/my/stories',
        cookies: { [sessionCookie.name]: sessionCookie.value },
        payload: {
          name: 'JSON Export Story',
          summary: 'Exported as JSON',
          genre: 'fantasy',
        },
      })
      const originalStoryId = createResponse.json().story.id

      // Create a character
      await app.inject({
        method: 'POST',
        url: `/my/stories/${originalStoryId}/characters`,
        cookies: { [sessionCookie.name]: sessionCookie.value },
        payload: {
          firstName: 'Bob',
          lastName: 'Builder',
          description: 'Can we fix it?',
        },
      })

      // Export as ZIP first
      const exportResponse = await app.inject({
        method: 'GET',
        url: `/my/stories/${originalStoryId}/export-zip`,
        cookies: { [sessionCookie.name]: sessionCookie.value },
      })

      // Parse the ZIP to get the story data
      const zipBuffer = exportResponse.rawPayload
      const directory = await unzipper.Open.buffer(zipBuffer)
      const manifestFile = directory.files.find((f) => f.path === 'manifest.json')
      const storyFile = directory.files.find((f) => f.path === 'story.json')
      const manifestBuffer = await manifestFile!.buffer()
      const storyBuffer = await storyFile!.buffer()
      const manifest = JSON.parse(manifestBuffer.toString('utf-8'))
      const storyData = JSON.parse(storyBuffer.toString('utf-8'))

      // Create JSON bundle (same format as artifact export)
      const jsonBundle = {
        manifest,
        story: storyData,
      }

      // Import as JSON
      const form = new FormData()
      form.append('file', Buffer.from(JSON.stringify(jsonBundle)), {
        filename: 'story-export.json',
        contentType: 'application/json',
      })

      const importResponse = await app.inject({
        method: 'POST',
        url: '/my/stories/import-zip',
        headers: { ...form.getHeaders() },
        payload: form,
        cookies: { [sessionCookie.name]: sessionCookie.value },
      })

      expect(importResponse.statusCode).toBe(201)
      const importBody = importResponse.json()
      expect(importBody.success).toBe(true)
      expect(importBody.storyId).toBeDefined()
      expect(importBody.storyName).toBe('JSON Export Story')

      // Verify the imported story exists
      const getResponse = await app.inject({
        method: 'GET',
        url: `/my/stories/${importBody.storyId}`,
        cookies: { [sessionCookie.name]: sessionCookie.value },
      })

      expect(getResponse.statusCode).toBe(200)
      const importedStory = getResponse.json().story
      expect(importedStory.name).toBe('JSON Export Story')
      expect(importedStory.summary).toBe('Exported as JSON')
      expect(importedStory.genre).toBe('fantasy')

      // Verify character was imported
      const characters = await prisma.character.findMany({
        where: { storyId: importBody.storyId },
      })
      expect(characters).toHaveLength(1)
      expect(characters[0].firstName).toBe('Bob')
      expect(characters[0].lastName).toBe('Builder')
    })

    test('should import direct story JSON without bundle wrapper', async () => {
      // Create a story
      const createResponse = await app.inject({
        method: 'POST',
        url: '/my/stories',
        cookies: { [sessionCookie.name]: sessionCookie.value },
        payload: {
          name: 'Direct JSON Story',
          summary: 'No wrapper',
        },
      })
      const originalStoryId = createResponse.json().story.id

      // Export as ZIP
      const exportResponse = await app.inject({
        method: 'GET',
        url: `/my/stories/${originalStoryId}/export-zip`,
        cookies: { [sessionCookie.name]: sessionCookie.value },
      })

      // Parse the ZIP to get just the story data
      const zipBuffer = exportResponse.rawPayload
      const directory = await unzipper.Open.buffer(zipBuffer)
      const storyFile = directory.files.find((f) => f.path === 'story.json')
      const storyBuffer = await storyFile!.buffer()
      const storyData = JSON.parse(storyBuffer.toString('utf-8'))

      // Import as direct JSON (no manifest wrapper)
      const form = new FormData()
      form.append('file', Buffer.from(JSON.stringify(storyData)), {
        filename: 'story.json',
        contentType: 'application/json',
      })

      const importResponse = await app.inject({
        method: 'POST',
        url: '/my/stories/import-zip',
        headers: { ...form.getHeaders() },
        payload: form,
        cookies: { [sessionCookie.name]: sessionCookie.value },
      })

      expect(importResponse.statusCode).toBe(201)
      const importBody = importResponse.json()
      expect(importBody.success).toBe(true)
      expect(importBody.storyName).toBe('Direct JSON Story')
    })
  })

  describe('Round-trip export/import', () => {
    test('should preserve all data through export/import cycle', async () => {
      // Create a comprehensive story
      const createResponse = await app.inject({
        method: 'POST',
        url: '/my/stories',
        cookies: { [sessionCookie.name]: sessionCookie.value },
        payload: {
          name: 'Comprehensive Story',
          summary: 'A story with lots of data',
          genre: 'sci-fi',
          format: 'narrative',
          paragraphsPerTurn: 5,
        },
      })
      const originalStoryId = createResponse.json().story.id

      // Create multiple characters
      for (const name of ['Hero', 'Villain', 'Sidekick']) {
        await app.inject({
          method: 'POST',
          url: `/my/stories/${originalStoryId}/characters`,
          cookies: { [sessionCookie.name]: sessionCookie.value },
          payload: {
            firstName: name,
            description: `The ${name.toLowerCase()} of the story`,
            isMainCharacter: name === 'Hero',
          },
        })
      }

      // Create context items
      for (const item of [
        { type: 'location', name: 'Space Station', description: 'Main setting' },
        { type: 'theme', name: 'Survival', description: 'Key theme' },
      ]) {
        await app.inject({
          method: 'POST',
          url: `/my/stories/${originalStoryId}/context-items`,
          cookies: { [sessionCookie.name]: sessionCookie.value },
          payload: item,
        })
      }

      // Create book structure
      const bookResponse = await app.inject({
        method: 'POST',
        url: `/my/stories/${originalStoryId}/books`,
        cookies: { [sessionCookie.name]: sessionCookie.value },
        payload: { name: 'Volume 1' },
      })
      const bookId = bookResponse.json().book.id

      const arcResponse = await app.inject({
        method: 'POST',
        url: `/my/books/${bookId}/arcs`,
        cookies: { [sessionCookie.name]: sessionCookie.value },
        payload: { name: 'The Beginning' },
      })
      const arcId = arcResponse.json().arc.id

      const chapterResponse = await app.inject({
        method: 'POST',
        url: `/my/arcs/${arcId}/chapters`,
        cookies: { [sessionCookie.name]: sessionCookie.value },
        payload: { name: 'First Contact' },
      })
      const chapterId = chapterResponse.json().chapter.id

      await app.inject({
        method: 'POST',
        url: `/my/chapters/${chapterId}/scenes`,
        cookies: { [sessionCookie.name]: sessionCookie.value },
        payload: { name: 'The Discovery', goal: 'Introduce the protagonist' },
      })

      // Export
      const exportResponse = await app.inject({
        method: 'GET',
        url: `/my/stories/${originalStoryId}/export-zip`,
        cookies: { [sessionCookie.name]: sessionCookie.value },
      })

      expect(exportResponse.statusCode).toBe(200)

      // Import
      const form = new FormData()
      form.append('file', exportResponse.rawPayload, {
        filename: 'comprehensive-story.zip',
        contentType: 'application/zip',
      })

      const importResponse = await app.inject({
        method: 'POST',
        url: '/my/stories/import-zip',
        headers: { ...form.getHeaders() },
        payload: form,
        cookies: { [sessionCookie.name]: sessionCookie.value },
      })

      expect(importResponse.statusCode).toBe(201)
      const { storyId: importedStoryId } = importResponse.json()

      // Verify imported story data
      const importedStory = await prisma.story.findUnique({
        where: { id: importedStoryId },
      })
      expect(importedStory!.name).toBe('Comprehensive Story')
      expect(importedStory!.summary).toBe('A story with lots of data')
      expect(importedStory!.genre).toBe('sci-fi')
      expect(importedStory!.format).toBe('narrative')
      expect(importedStory!.paragraphsPerTurn).toBe(5)

      // Verify characters
      const importedCharacters = await prisma.character.findMany({
        where: { storyId: importedStoryId },
        orderBy: { firstName: 'asc' },
      })
      expect(importedCharacters).toHaveLength(3)
      expect(importedCharacters.map((c) => c.firstName)).toEqual(['Hero', 'Sidekick', 'Villain'])

      // Verify context items
      const importedContextItems = await prisma.contextItem.findMany({
        where: { storyId: importedStoryId },
        orderBy: { name: 'asc' },
      })
      expect(importedContextItems).toHaveLength(2)
      expect(importedContextItems.map((ci) => ci.name)).toEqual(['Space Station', 'Survival'])

      // Verify book hierarchy
      const importedBooks = await prisma.book.findMany({
        where: { storyId: importedStoryId },
        include: {
          arcs: {
            include: {
              chapters: {
                include: {
                  scenes: true,
                },
              },
            },
          },
        },
      })

      expect(importedBooks).toHaveLength(1)
      expect(importedBooks[0].name).toBe('Volume 1')
      expect(importedBooks[0].arcs[0].name).toBe('The Beginning')
      expect(importedBooks[0].arcs[0].chapters[0].name).toBe('First Contact')
      expect(importedBooks[0].arcs[0].chapters[0].scenes[0].name).toBe('The Discovery')
      expect(importedBooks[0].arcs[0].chapters[0].scenes[0].goal).toBe('Introduce the protagonist')
    })
  })

  describe('CYOA Format Import', () => {
    test('should import CYOA format with messages array', async () => {
      // Create CYOA format data (like from artifact exports)
      const cyoaData = {
        messages: [
          { role: 'assistant', content: 'You wake up in a mysterious forest.' },
          { role: 'user', content: 'I look around for any signs of civilization.' },
          { role: 'assistant', content: 'You spot smoke rising in the distance.' },
          { role: 'user', content: 'I head toward the smoke.' },
        ],
        memory: '# Adventure Memory\n\n## Setting\nMedieval fantasy world',
        protagonist: 'Alex',
        pitch: 'A mysterious adventure in an enchanted forest',
        savedAt: new Date().toISOString(),
      }

      // Import as JSON
      const form = new FormData()
      form.append('file', Buffer.from(JSON.stringify(cyoaData)), {
        filename: 'cyoa-story.json',
        contentType: 'application/json',
      })

      const importResponse = await app.inject({
        method: 'POST',
        url: '/my/stories/import-zip',
        headers: { ...form.getHeaders() },
        payload: form,
        cookies: { [sessionCookie.name]: sessionCookie.value },
      })

      expect(importResponse.statusCode).toBe(201)
      const importBody = importResponse.json()
      expect(importBody.success).toBe(true)
      expect(importBody.storyId).toBeDefined()
      expect(importBody.storyName).toBe('A mysterious adventure in an enchanted forest')

      // Verify the imported story
      const story = await prisma.story.findUnique({
        where: { id: importBody.storyId },
      })
      expect(story).toBeDefined()
      expect(story!.format).toBe('cyoa')
      expect(story!.defaultPerspective).toBe('SECOND')
      expect(story!.globalScript).toBe('# Adventure Memory\n\n## Setting\nMedieval fantasy world')

      // Verify protagonist character was created
      const characters = await prisma.character.findMany({
        where: { storyId: importBody.storyId },
      })
      expect(characters).toHaveLength(1)
      expect(characters[0].firstName).toBe('Alex')
      expect(characters[0].isMainCharacter).toBe(true)

      // Verify messages were converted
      const books = await prisma.book.findMany({
        where: { storyId: importBody.storyId },
        include: {
          arcs: {
            include: {
              chapters: {
                include: {
                  scenes: {
                    include: {
                      messages: {
                        orderBy: { sortOrder: 'asc' },
                        include: {
                          messageRevisions: {
                            include: {
                              paragraphs: {
                                include: {
                                  paragraphRevisions: true,
                                },
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      })

      expect(books).toHaveLength(1)
      expect(books[0].arcs).toHaveLength(1)
      expect(books[0].arcs[0].chapters).toHaveLength(1)
      expect(books[0].arcs[0].chapters[0].scenes).toHaveLength(1)

      const scene = books[0].arcs[0].chapters[0].scenes[0]
      expect(scene.messages).toHaveLength(4)

      // Check first message (assistant/prose)
      expect(scene.messages[0].type).toBe('prose')
      expect(scene.messages[0].messageRevisions[0].paragraphs[0].paragraphRevisions[0].body).toBe(
        'You wake up in a mysterious forest.',
      )

      // Check second message (user)
      expect(scene.messages[1].type).toBe('user')
      expect(scene.messages[1].messageRevisions[0].paragraphs[0].paragraphRevisions[0].body).toBe(
        'I look around for any signs of civilization.',
      )

      // Check third message (assistant/prose)
      expect(scene.messages[2].type).toBe('prose')
      expect(scene.messages[2].messageRevisions[0].paragraphs[0].paragraphRevisions[0].body).toBe(
        'You spot smoke rising in the distance.',
      )

      // Check fourth message (user)
      expect(scene.messages[3].type).toBe('user')
      expect(scene.messages[3].messageRevisions[0].paragraphs[0].paragraphRevisions[0].body).toBe(
        'I head toward the smoke.',
      )
    })

    test('should import CYOA format without protagonist', async () => {
      const cyoaData = {
        messages: [
          { role: 'assistant', content: 'Welcome to the adventure!' },
          { role: 'user', content: 'Hello!' },
        ],
        pitch: 'A simple test adventure',
        savedAt: new Date().toISOString(),
      }

      const form = new FormData()
      form.append('file', Buffer.from(JSON.stringify(cyoaData)), {
        filename: 'simple-cyoa.json',
        contentType: 'application/json',
      })

      const importResponse = await app.inject({
        method: 'POST',
        url: '/my/stories/import-zip',
        headers: { ...form.getHeaders() },
        payload: form,
        cookies: { [sessionCookie.name]: sessionCookie.value },
      })

      expect(importResponse.statusCode).toBe(201)

      const importBody = importResponse.json()

      // Should have no characters
      const characters = await prisma.character.findMany({
        where: { storyId: importBody.storyId },
      })
      expect(characters).toHaveLength(0)

      // Story should exist with messages
      const story = await prisma.story.findUnique({
        where: { id: importBody.storyId },
      })
      expect(story!.defaultProtagonistId).toBeNull()
    })

    test('should generate story name from pitch if no name provided', async () => {
      const cyoaData = {
        messages: [
          { role: 'assistant', content: 'Start of the adventure.' },
        ],
        pitch:
          'This is a very long pitch that describes the entire story premise and should be truncated when used as a name',
        savedAt: new Date().toISOString(),
      }

      const form = new FormData()
      form.append('file', Buffer.from(JSON.stringify(cyoaData)), {
        filename: 'long-pitch.json',
        contentType: 'application/json',
      })

      const importResponse = await app.inject({
        method: 'POST',
        url: '/my/stories/import-zip',
        headers: { ...form.getHeaders() },
        payload: form,
        cookies: { [sessionCookie.name]: sessionCookie.value },
      })

      expect(importResponse.statusCode).toBe(201)
      const importBody = importResponse.json()

      // Name should be truncated from the first line of pitch
      expect(importBody.storyName.length).toBeLessThanOrEqual(100)
    })

    test('should use default name when no pitch provided', async () => {
      const cyoaData = {
        messages: [
          { role: 'assistant', content: 'Nameless adventure begins.' },
        ],
        savedAt: new Date().toISOString(),
      }

      const form = new FormData()
      form.append('file', Buffer.from(JSON.stringify(cyoaData)), {
        filename: 'nameless.json',
        contentType: 'application/json',
      })

      const importResponse = await app.inject({
        method: 'POST',
        url: '/my/stories/import-zip',
        headers: { ...form.getHeaders() },
        payload: form,
        cookies: { [sessionCookie.name]: sessionCookie.value },
      })

      expect(importResponse.statusCode).toBe(201)
      const importBody = importResponse.json()
      expect(importBody.storyName).toBe('Imported CYOA Story')
    })
  })
})
