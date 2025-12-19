/**
 * REST API client for mythweavers-backend
 */

// API base URL configuration
const getApiUrl = () => {
  // Server-side: use env variable
  if (typeof window === 'undefined') {
    return import.meta.env.API_URL || 'http://localhost:3201'
  }
  // Client-side: check if on localhost
  if (window.location.host.includes('localhost')) {
    return 'http://localhost:3201'
  }
  // Production
  return import.meta.env.PUBLIC_API_URL || 'https://api.mythweavers.com'
}

// Type definitions
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

export interface Announcement {
  id: string
  title: string
  content: string
  author: string
  createdAt: string
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
// Pass `cookie` string for SSR calls (from Astro.cookies)
async function fetchApi<T>(endpoint: string, options: RequestInit & { cookie?: string } = {}): Promise<T> {
  const url = `${getApiUrl()}${endpoint}`
  const { cookie, ...fetchOptions } = options

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  }

  // For SSR, pass cookie header explicitly
  if (cookie) {
    headers['Cookie'] = cookie
  }

  const response = await fetch(url, {
    ...fetchOptions,
    credentials: 'include',
    headers,
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

  async getSession(cookie?: string): Promise<SessionResponse> {
    return fetchApi('/auth/session', { cookie })
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
    sortBy?: 'recent' | 'popular' | 'title' | 'random'
    genre?: string
    filterAbandoned?: boolean
  }): Promise<ListStoriesResponse> {
    const searchParams = new URLSearchParams()
    if (params?.page) searchParams.set('page', params.page.toString())
    if (params?.pageSize) searchParams.set('pageSize', params.pageSize.toString())
    if (params?.search) searchParams.set('search', params.search)
    if (params?.status) searchParams.set('status', params.status)
    if (params?.type) searchParams.set('type', params.type)
    if (params?.sortBy) searchParams.set('sortBy', params.sortBy)
    if (params?.genre) searchParams.set('genre', params.genre)
    if (params?.filterAbandoned) searchParams.set('filterAbandoned', 'true')

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

// Announcements API
export const announcementsApi = {
  async list(): Promise<{ announcements: Announcement[] }> {
    try {
      return await fetchApi('/announcements')
    } catch {
      // Fallback if endpoint doesn't exist yet
      return { announcements: [] }
    }
  },
}
