import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test'
import { promises as fs, createReadStream } from 'node:fs'
import { join } from 'node:path'
import type { FastifyInstance } from 'fastify'
import FormData from 'form-data'
import sharp from 'sharp'
import { getUploadDir } from '../src/lib/file-storage.js'
import { prisma } from '../src/lib/prisma.js'
import { buildApp, cleanDatabase } from './helpers.js'

let app: FastifyInstance
let sessionCookie: { name: string; value: string }
let userId: number
let storyId: string

// Test image paths
const testImagesDir = join(import.meta.dir, 'fixtures')
const testImagePath = join(testImagesDir, 'test-image.png')
const testImagePath2 = join(testImagesDir, 'test-image-2.jpg')

beforeAll(async () => {
  app = await buildApp()
  await app.ready()

  // Create test images directory
  await fs.mkdir(testImagesDir, { recursive: true })

  // Create a test PNG image (1x1 red pixel)
  await sharp({
    create: {
      width: 100,
      height: 100,
      channels: 4,
      background: { r: 255, g: 0, b: 0, alpha: 1 },
    },
  })
    .png()
    .toFile(testImagePath)

  // Create a test JPG image (1x1 blue pixel)
  await sharp({
    create: {
      width: 200,
      height: 150,
      channels: 4,
      background: { r: 0, g: 0, b: 255, alpha: 1 },
    },
  })
    .jpeg()
    .toFile(testImagePath2)
})

afterAll(async () => {
  await app.close()

  // Clean up test images
  await fs.rm(testImagesDir, { recursive: true, force: true })

  // Clean up uploads directory (test files)
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

  // Create a test story
  const storyResponse = await app.inject({
    method: 'POST',
    url: '/my/stories',
    cookies: { [sessionCookie.name]: sessionCookie.value },
    payload: {
      name: 'Test Story',
    },
  })
  storyId = storyResponse.json().story.id
})

describe('File Upload Endpoints', () => {
  describe('POST /my/files', () => {
    test('should upload a file successfully', async () => {
      const form = new FormData()
      form.append('file', createReadStream(testImagePath), {
        filename: 'test-image.png',
        contentType: 'image/png',
      })

      const response = await app.inject({
        method: 'POST',
        url: '/my/files',
        headers: {
          ...form.getHeaders(),
        },
        payload: form,
        cookies: { [sessionCookie.name]: sessionCookie.value },
      })

      expect(response.statusCode).toBe(201)
      const body = response.json()
      expect(body.success).toBe(true)

      // Store localPath before toMatchObject overwrites it
      const localPath = body.file.localPath

      expect(body.file).toMatchObject({
        id: expect.any(String),
        ownerId: userId,
        storyId: null,
        localPath: expect.any(String),
        path: expect.stringContaining('/files/'),
        sha256: expect.any(String),
        width: 100,
        height: 100,
        bytes: expect.any(Number),
        mimeType: 'image/png',
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
      })

      // Verify file exists on filesystem
      const fileExists = await fs
        .access(localPath)
        .then(() => true)
        .catch(() => false)
      expect(fileExists).toBe(true)
    })

    test('should upload file with storyId', async () => {
      const form = new FormData()
      form.append('file', createReadStream(testImagePath), {
        filename: 'test-image.png',
        contentType: 'image/png',
      })
      form.append('storyId', storyId)

      const response = await app.inject({
        method: 'POST',
        url: '/my/files',
        headers: {
          ...form.getHeaders(),
        },
        payload: form,
        cookies: { [sessionCookie.name]: sessionCookie.value },
      })

      expect(response.statusCode).toBe(201)
      const body = response.json()
      expect(body.file.storyId).toBe(storyId)
    })

    test('should deduplicate files with same SHA256', async () => {
      // Upload first file
      const form1 = new FormData()
      form1.append('file', createReadStream(testImagePath), {
        filename: 'test-image.png',
        contentType: 'image/png',
      })

      const response1 = await app.inject({
        method: 'POST',
        url: '/my/files',
        headers: {
          ...form1.getHeaders(),
        },
        payload: form1,
        cookies: { [sessionCookie.name]: sessionCookie.value },
      })

      const file1 = response1.json().file

      // Upload same file again
      const form2 = new FormData()
      form2.append('file', createReadStream(testImagePath), {
        filename: 'different-name.png',
        contentType: 'image/png',
      })

      const response2 = await app.inject({
        method: 'POST',
        url: '/my/files',
        headers: {
          ...form2.getHeaders(),
        },
        payload: form2,
        cookies: { [sessionCookie.name]: sessionCookie.value },
      })

      expect(response2.statusCode).toBe(201)
      const file2 = response2.json().file

      // Should return the same file (deduplication)
      expect(file2.id).toBe(file1.id)
      expect(file2.sha256).toBe(file1.sha256)

      // Check only one file exists in database
      const fileCount = await prisma.file.count({
        where: { ownerId: userId },
      })
      expect(fileCount).toBe(1)
    })

    test('should reject without authentication', async () => {
      const form = new FormData()
      form.append('file', createReadStream(testImagePath), {
        filename: 'test-image.png',
        contentType: 'image/png',
      })

      const response = await app.inject({
        method: 'POST',
        url: '/my/files',
        headers: {
          ...form.getHeaders(),
        },
        payload: form,
      })

      expect(response.statusCode).toBe(401)
    })

    test('should reject with no file', async () => {
      const form = new FormData()

      const response = await app.inject({
        method: 'POST',
        url: '/my/files',
        headers: {
          ...form.getHeaders(),
        },
        payload: form,
        cookies: { [sessionCookie.name]: sessionCookie.value },
      })

      expect(response.statusCode).toBe(400)
      expect(response.json().error).toContain('No file provided')
    })

    test('should reject invalid storyId', async () => {
      const form = new FormData()
      form.append('file', createReadStream(testImagePath), {
        filename: 'test-image.png',
        contentType: 'image/png',
      })
      form.append('storyId', 'invalid-story-id')

      const response = await app.inject({
        method: 'POST',
        url: '/my/files',
        headers: {
          ...form.getHeaders(),
        },
        payload: form,
        cookies: { [sessionCookie.name]: sessionCookie.value },
      })

      expect(response.statusCode).toBe(404)
      expect(response.json().error).toContain('Story not found')
    })
  })

  describe('GET /my/files', () => {
    let _fileId1: string
    let fileId2: string

    beforeEach(async () => {
      // Upload test files
      const form1 = new FormData()
      form1.append('file', createReadStream(testImagePath), {
        filename: 'file1.png',
        contentType: 'image/png',
      })

      const response1 = await app.inject({
        method: 'POST',
        url: '/my/files',
        headers: { ...form1.getHeaders() },
        payload: form1,
        cookies: { [sessionCookie.name]: sessionCookie.value },
      })
      _fileId1 = response1.json().file.id

      const form2 = new FormData()
      form2.append('file', createReadStream(testImagePath2), {
        filename: 'file2.jpg',
        contentType: 'image/jpeg',
      })
      form2.append('storyId', storyId)

      const response2 = await app.inject({
        method: 'POST',
        url: '/my/files',
        headers: { ...form2.getHeaders() },
        payload: form2,
        cookies: { [sessionCookie.name]: sessionCookie.value },
      })
      fileId2 = response2.json().file.id
    })

    test('should list user files', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/my/files',
        cookies: { [sessionCookie.name]: sessionCookie.value },
      })

      expect(response.statusCode).toBe(200)
      const body = response.json()
      expect(body.files).toHaveLength(2)
      expect(body.pagination).toMatchObject({
        page: 1,
        limit: 20,
        total: 2,
        totalPages: 1,
      })
    })

    test('should filter files by storyId', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/my/files?storyId=${storyId}`,
        cookies: { [sessionCookie.name]: sessionCookie.value },
      })

      expect(response.statusCode).toBe(200)
      const body = response.json()
      expect(body.files).toHaveLength(1)
      expect(body.files[0].id).toBe(fileId2)
      expect(body.files[0].storyId).toBe(storyId)
    })

    test('should paginate files', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/my/files?page=1&limit=1',
        cookies: { [sessionCookie.name]: sessionCookie.value },
      })

      expect(response.statusCode).toBe(200)
      const body = response.json()
      expect(body.files).toHaveLength(1)
      expect(body.pagination).toMatchObject({
        page: 1,
        limit: 1,
        total: 2,
        totalPages: 2,
      })
    })

    test('should require authentication', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/my/files',
      })

      expect(response.statusCode).toBe(401)
    })

    test('should only show user own files', async () => {
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

      // Other user should see no files
      const response = await app.inject({
        method: 'GET',
        url: '/my/files',
        cookies: { [otherSessionCookie.name]: otherSessionCookie.value },
      })

      expect(response.statusCode).toBe(200)
      expect(response.json().files).toHaveLength(0)
    })
  })

  describe('GET /my/files/:id', () => {
    let fileId: string

    beforeEach(async () => {
      const form = new FormData()
      form.append('file', createReadStream(testImagePath), {
        filename: 'test.png',
        contentType: 'image/png',
      })

      const response = await app.inject({
        method: 'POST',
        url: '/my/files',
        headers: { ...form.getHeaders() },
        payload: form,
        cookies: { [sessionCookie.name]: sessionCookie.value },
      })
      fileId = response.json().file.id
    })

    test('should get file by id', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/my/files/${fileId}`,
        cookies: { [sessionCookie.name]: sessionCookie.value },
      })

      expect(response.statusCode).toBe(200)
      const body = response.json()
      expect(body.file.id).toBe(fileId)
      expect(body.file.ownerId).toBe(userId)
    })

    test('should return 404 for non-existent file', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/my/files/nonexistent',
        cookies: { [sessionCookie.name]: sessionCookie.value },
      })

      expect(response.statusCode).toBe(404)
    })

    test('should not access other user files', async () => {
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

      // Try to access first user's file
      const response = await app.inject({
        method: 'GET',
        url: `/my/files/${fileId}`,
        cookies: { [otherSessionCookie.name]: otherSessionCookie.value },
      })

      expect(response.statusCode).toBe(404)
    })

    test('should require authentication', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/my/files/${fileId}`,
      })

      expect(response.statusCode).toBe(401)
    })
  })

  describe('DELETE /my/files/:id', () => {
    let fileId: string

    beforeEach(async () => {
      const form = new FormData()
      form.append('file', createReadStream(testImagePath), {
        filename: 'test.png',
        contentType: 'image/png',
      })

      const response = await app.inject({
        method: 'POST',
        url: '/my/files',
        headers: { ...form.getHeaders() },
        payload: form,
        cookies: { [sessionCookie.name]: sessionCookie.value },
      })
      fileId = response.json().file.id
    })

    test('should delete file', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: `/my/files/${fileId}`,
        cookies: { [sessionCookie.name]: sessionCookie.value },
      })

      expect(response.statusCode).toBe(200)
      expect(response.json().success).toBe(true)

      // Verify file is deleted from database
      const file = await prisma.file.findUnique({ where: { id: fileId } })
      expect(file).toBeNull()
    })

    test('should return 404 for non-existent file', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: '/my/files/nonexistent',
        cookies: { [sessionCookie.name]: sessionCookie.value },
      })

      expect(response.statusCode).toBe(404)
    })

    test('should not delete other user files', async () => {
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

      // Try to delete first user's file
      const response = await app.inject({
        method: 'DELETE',
        url: `/my/files/${fileId}`,
        cookies: { [otherSessionCookie.name]: otherSessionCookie.value },
      })

      expect(response.statusCode).toBe(404)

      // Verify file still exists
      const file = await prisma.file.findUnique({ where: { id: fileId } })
      expect(file).not.toBeNull()
    })

    test('should require authentication', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: `/my/files/${fileId}`,
      })

      expect(response.statusCode).toBe(401)
    })

    test('should prevent deletion of file in use', async () => {
      // Use file as story cover art
      await prisma.story.update({
        where: { id: storyId },
        data: { coverArtFileId: fileId },
      })

      const response = await app.inject({
        method: 'DELETE',
        url: `/my/files/${fileId}`,
        cookies: { [sessionCookie.name]: sessionCookie.value },
      })

      expect(response.statusCode).toBe(409)
      expect(response.json().error).toContain('in use')
    })
  })
})
