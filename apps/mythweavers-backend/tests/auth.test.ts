import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import type { FastifyInstance } from 'fastify'
import { buildApp, cleanDatabase } from './helpers.js'

describe('Auth Endpoints', () => {
  let app: FastifyInstance

  beforeEach(async () => {
    app = await buildApp()
    await cleanDatabase()
  })

  afterEach(async () => {
    await app.close()
  })

  describe('POST /auth/register', () => {
    test('should register a new user successfully', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/auth/register',
        payload: {
          email: 'test@example.com',
          username: 'testuser',
          password: 'password123',
        },
      })

      expect(response.statusCode).toBe(200)
      const body = response.json()
      expect(body.success).toBe(true)
      expect(body.user).toMatchObject({
        id: expect.any(Number),
        email: 'test@example.com',
        username: 'testuser',
      })

      // Should set a session cookie
      const cookies = response.cookies
      expect(cookies).toHaveLength(1)
      expect(cookies[0].name).toBe('sessionToken')
    })

    test('should reject registration with short password', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/auth/register',
        payload: {
          email: 'test@example.com',
          username: 'testuser',
          password: 'short',
        },
      })

      expect(response.statusCode).toBe(400)
      const body = response.json()
      expect(body.error).toBeDefined()
    })

    test('should reject registration with invalid email', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/auth/register',
        payload: {
          email: 'not-an-email',
          username: 'testuser',
          password: 'password123',
        },
      })

      expect(response.statusCode).toBe(400)
      const body = response.json()
      expect(body.error).toBeDefined()
    })

    test('should reject registration with duplicate email', async () => {
      // First registration
      await app.inject({
        method: 'POST',
        url: '/auth/register',
        payload: {
          email: 'test@example.com',
          username: 'user1',
          password: 'password123',
        },
      })

      // Try to register again with same email
      const response = await app.inject({
        method: 'POST',
        url: '/auth/register',
        payload: {
          email: 'test@example.com',
          username: 'user2',
          password: 'password123',
        },
      })

      expect(response.statusCode).toBe(409)
      const body = response.json()
      expect(body.error).toBe('Email already registered')
    })

    test('should reject registration with duplicate username', async () => {
      // First registration
      await app.inject({
        method: 'POST',
        url: '/auth/register',
        payload: {
          email: 'user1@example.com',
          username: 'testuser',
          password: 'password123',
        },
      })

      // Try to register again with same username
      const response = await app.inject({
        method: 'POST',
        url: '/auth/register',
        payload: {
          email: 'user2@example.com',
          username: 'testuser',
          password: 'password123',
        },
      })

      expect(response.statusCode).toBe(409)
      const body = response.json()
      expect(body.error).toBe('Username already taken')
    })
  })

  describe('POST /auth/login', () => {
    beforeEach(async () => {
      // Create a test user
      await app.inject({
        method: 'POST',
        url: '/auth/register',
        payload: {
          email: 'test@example.com',
          username: 'testuser',
          password: 'password123',
        },
      })
    })

    test('should login with username', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/auth/login',
        payload: {
          username: 'testuser',
          password: 'password123',
        },
      })

      expect(response.statusCode).toBe(200)
      const body = response.json()
      expect(body.success).toBe(true)
      expect(body.user.username).toBe('testuser')

      // Should set a session cookie
      const cookies = response.cookies
      expect(cookies).toHaveLength(1)
      expect(cookies[0].name).toBe('sessionToken')
    })

    test('should login with email', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/auth/login',
        payload: {
          username: 'test@example.com', // Can use email in username field
          password: 'password123',
        },
      })

      expect(response.statusCode).toBe(200)
      const body = response.json()
      expect(body.success).toBe(true)
      expect(body.user.email).toBe('test@example.com')
    })

    test('should reject login with wrong password', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/auth/login',
        payload: {
          username: 'testuser',
          password: 'wrongpassword',
        },
      })

      expect(response.statusCode).toBe(401)
      const body = response.json()
      expect(body.error).toBe('Invalid credentials')
    })

    test('should reject login with non-existent user', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/auth/login',
        payload: {
          username: 'nonexistent',
          password: 'password123',
        },
      })

      expect(response.statusCode).toBe(401)
      const body = response.json()
      expect(body.error).toBe('Invalid credentials')
    })
  })

  describe('GET /auth/session', () => {
    test('should return authenticated=false without cookie', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/auth/session',
      })

      expect(response.statusCode).toBe(200)
      const body = response.json()
      expect(body.authenticated).toBe(false)
    })

    test('should return user info with valid session', async () => {
      // Register and get session cookie
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

      // Check session
      const response = await app.inject({
        method: 'GET',
        url: '/auth/session',
        cookies: {
          [sessionCookie.name]: sessionCookie.value,
        },
      })

      expect(response.statusCode).toBe(200)
      const body = response.json()
      expect(body.authenticated).toBe(true)
      expect(body.user).toMatchObject({
        id: expect.any(Number),
        email: 'test@example.com',
        username: 'testuser',
      })
    })
  })

  describe('POST /auth/logout', () => {
    test('should logout successfully', async () => {
      // Register and get session cookie
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

      // Logout
      const logoutResponse = await app.inject({
        method: 'POST',
        url: '/auth/logout',
        cookies: {
          [sessionCookie.name]: sessionCookie.value,
        },
      })

      expect(logoutResponse.statusCode).toBe(200)
      const body = logoutResponse.json()
      expect(body.success).toBe(true)

      // Session should no longer be valid
      const sessionResponse = await app.inject({
        method: 'GET',
        url: '/auth/session',
        cookies: {
          [sessionCookie.name]: sessionCookie.value,
        },
      })

      const sessionBody = sessionResponse.json()
      expect(sessionBody.authenticated).toBe(false)
    })

    test('should handle logout without session cookie', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/auth/logout',
      })

      expect(response.statusCode).toBe(200)
      const body = response.json()
      expect(body.success).toBe(true)
    })
  })
})
