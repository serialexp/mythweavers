/**
 * REST API client for mythweavers-backend
 * Replaces the tRPC client with direct fetch calls
 */

import { isServer } from 'solid-js/web'

// API base URL configuration
const getApiUrl = () => {
  if (isServer) {
    return process.env.API_URL || 'http://localhost:3201'
  }
  // In browser, check if we're on localhost
  if (typeof window !== 'undefined' && window.location.host.includes('localhost')) {
    return 'http://localhost:3201'
  }
  // Production API URL
  return process.env.VITE_API_URL || 'https://api.mythweavers.com'
}

// Type definitions matching the backend schemas
export interface User {
  id: number
  email: string
  username: string
}

export interface PublicStory {
  id: string
  name: string
  summary: string | null
  owner: {
    id: number
    username: string
  }
  status: 'COMPLETED' | 'ONGOING' | 'HIATUS'
  type: 'FANFICTION' | 'ORIGINAL'
  coverColor: string
  coverTextColor: string
  coverFontFamily: string
  pages: number | null
  createdAt: string
  updatedAt: string
}

export interface Book {
  id: string
  name: string
  sortOrder: number
  arcs: Arc[]
}

export interface Arc {
  id: string
  name: string
  sortOrder: number
  chapters: Chapter[]
}

export interface Chapter {
  id: string
  name: string
  sortOrder: number
  summary?: string | null
}

export interface StoryWithStructure extends PublicStory {
  books: Book[]
}

export interface ChapterContent {
  id: string
  name: string
  content: string
  previousChapterId: string | null
  nextChapterId: string | null
}

export interface Pagination {
  page: number
  pageSize: number
  total: number
  totalPages: number
}

export interface ListStoriesResponse {
  stories: PublicStory[]
  pagination: Pagination
}

export interface AuthResponse {
  success: boolean
  user: User
}

export interface SessionResponse {
  authenticated: boolean
  user?: User
}

// API error type
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

// Fetch wrapper with error handling
async function fetchApi<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${getApiUrl()}${endpoint}`

  const response = await fetch(url, {
    ...options,
    credentials: 'include', // Include cookies for session auth
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }))
    throw new ApiError(response.status, error.error || `HTTP ${response.status}`)
  }

  return response.json()
}

// Auth API
export const authApi = {
  async login(username: string, password: string): Promise<AuthResponse> {
    return fetchApi('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    })
  },

  async register(email: string, username: string, password: string): Promise<AuthResponse> {
    return fetchApi('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, username, password }),
    })
  },

  async logout(): Promise<{ success: boolean }> {
    return fetchApi('/auth/logout', {
      method: 'POST',
    })
  },

  async getSession(): Promise<SessionResponse> {
    return fetchApi('/auth/session')
  },
}

// Stories API
export const storiesApi = {
  async list(params?: {
    page?: number
    pageSize?: number
    search?: string
    status?: 'COMPLETED' | 'ONGOING' | 'HIATUS'
    type?: 'FANFICTION' | 'ORIGINAL'
    sortBy?: 'recent' | 'popular' | 'title'
  }): Promise<ListStoriesResponse> {
    const searchParams = new URLSearchParams()
    if (params?.page) searchParams.set('page', params.page.toString())
    if (params?.pageSize) searchParams.set('pageSize', params.pageSize.toString())
    if (params?.search) searchParams.set('search', params.search)
    if (params?.status) searchParams.set('status', params.status)
    if (params?.type) searchParams.set('type', params.type)
    if (params?.sortBy) searchParams.set('sortBy', params.sortBy)

    const query = searchParams.toString()
    return fetchApi(`/stories${query ? `?${query}` : ''}`)
  },

  async get(id: string): Promise<{ story: PublicStory }> {
    return fetchApi(`/stories/${id}`)
  },

  async getWithStructure(id: string): Promise<{ story: StoryWithStructure }> {
    return fetchApi(`/stories/${id}/structure`)
  },

  async getChapter(storyId: string, chapterId: string): Promise<{ chapter: ChapterContent }> {
    return fetchApi(`/stories/${storyId}/chapters/${chapterId}`)
  },
}
