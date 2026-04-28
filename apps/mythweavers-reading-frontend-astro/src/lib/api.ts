/**
 * REST API client for mythweavers-backend.
 *
 * Public exports (`authApi`, `storiesApi`, `bookshelfApi`, `announcementsApi`,
 * type aliases, `resolveCoverArtUrl`) are kept stable so existing call sites
 * don't need to change. Internally each function delegates to the generated
 * SDK from `src/api-client/`, configured in `src/client/config.ts`.
 *
 * SSR cookie pass-through: every request that needs a session forwards the
 * raw `Cookie` header via the SDK's `headers` option.
 */

import {
  deleteMyBookshelfByStoryIdByKind,
  getAuthors,
  getAuthorsById,
  getAuthSession,
  getMyBookshelf,
  getMyBookshelfByStoryId,
  getMyReadingStatus,
  getMyReadingStatusByStoryId,
  getMyStories,
  getStories,
  getStoriesById,
  getStoriesByIdChaptersByChapterId,
  getStoriesByIdStructure,
  getApiBaseUrl as sdkBaseUrl,
  postAuthChangePassword,
  postAuthLogin,
  postAuthLogout,
  postAuthRegister,
  postMyBookshelf,
  postMyReadingStatus,
} from '../client/config'

// ---------------------------------------------------------------------------
// Public type re-exports — preserve the manual surface so consumers
// (.astro pages, components) don't have to learn the generated shapes.
// ---------------------------------------------------------------------------

export interface User {
  id: number
  email: string
  username: string
}

export interface PublicStory {
  id: string
  name: string
  summary: string | null
  owner: { id: number; username: string }
  status: 'COMPLETED' | 'ONGOING' | 'HIATUS'
  type: 'FANFICTION' | 'ORIGINAL'
  coverColor: string
  coverTextColor: string
  coverFontFamily: string
  coverArtUrl: string | null
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
  wordCount: number
}

export interface StoryWithStructure extends PublicStory {
  books: Book[]
}

export type ChapterBlock =
  | { type: 'paragraphs'; html: string }
  | { type: 'background'; url: string; fileId: string }
  | { type: 'audio'; url: string; fileId: string; mimeType: string }

export interface ChapterScene {
  id: string
  blocks: ChapterBlock[]
}

export interface ChapterContent {
  id: string
  name: string
  enteringBackgroundUrl: string | null
  scenes: ChapterScene[]
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

// ---------------------------------------------------------------------------
// Bookshelf
// ---------------------------------------------------------------------------

export type SavedKind = 'FAVORITE' | 'FOLLOW' | 'READ_LATER'

export interface BookshelfStory extends PublicStory {
  /** Save categories the current user has set for this story. */
  kinds: SavedKind[]
}

export interface BookshelfStatus {
  FAVORITE: boolean
  FOLLOW: boolean
  READ_LATER: boolean
}

// ---------------------------------------------------------------------------
// Errors + helpers
// ---------------------------------------------------------------------------

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

/**
 * Resolve a relative file path (e.g. `/files/1/2025/12/cover.png`) into an
 * absolute URL pointing at the backend. Returns null for nullish input.
 */
export function resolveCoverArtUrl(coverArtUrl: string | null | undefined): string | null {
  if (!coverArtUrl) return null
  if (coverArtUrl.startsWith('http://') || coverArtUrl.startsWith('https://')) return coverArtUrl
  return `${sdkBaseUrl()}${coverArtUrl}`
}

/**
 * Build SSR headers from a cookie string. Empty cookies are omitted so the
 * browser path doesn't end up sending an empty `Cookie:` header.
 */
const ssrHeaders = (cookie?: string): Record<string, string> | undefined =>
  cookie ? { cookie } : undefined

/**
 * Throw a typed ApiError if the SDK call returned an error envelope.
 * The hey-api error body has shape `{ error: string }` for our backend.
 */
function unwrap<T>(result: { data?: T; error?: unknown; response: Response }): T {
  if (result.error) {
    const err = result.error as { error?: string } | undefined
    throw new ApiError(result.response.status, err?.error || `HTTP ${result.response.status}`)
  }
  if (result.data === undefined) {
    throw new ApiError(result.response.status, `HTTP ${result.response.status}`)
  }
  return result.data
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

export const authApi = {
  async login(username: string, password: string): Promise<AuthResponse> {
    return unwrap(await postAuthLogin({ body: { username, password } })) as AuthResponse
  },

  async register(email: string, username: string, password: string): Promise<AuthResponse> {
    return unwrap(await postAuthRegister({ body: { email, username, password } })) as AuthResponse
  },

  async logout(): Promise<{ success: boolean }> {
    return unwrap(await postAuthLogout()) as { success: boolean }
  },

  async getSession(cookie?: string): Promise<SessionResponse> {
    return unwrap(await getAuthSession({ headers: ssrHeaders(cookie) })) as SessionResponse
  },
}

// ---------------------------------------------------------------------------
// Stories (public)
// ---------------------------------------------------------------------------

export const storiesApi = {
  async list(params?: {
    page?: number
    pageSize?: number
    search?: string
    status?: 'COMPLETED' | 'ONGOING' | 'HIATUS'
    type?: 'FANFICTION' | 'ORIGINAL'
    sortBy?: 'recent' | 'popular' | 'title' | 'random'
    /** Reserved — backend does not currently filter by genre. Ignored server-side. */
    genre?: string
    /** Reserved — backend does not currently support filterAbandoned. Ignored server-side. */
    filterAbandoned?: boolean
  }): Promise<ListStoriesResponse> {
    // Only the SDK-known fields go on the query string. Unknown filters
    // (`genre`, `filterAbandoned`) are accepted in the type for backward
    // compatibility but dropped here until the backend supports them.
    return unwrap(
      await getStories({
        query: {
          ...(params?.page !== undefined && { page: params.page }),
          ...(params?.pageSize !== undefined && { pageSize: params.pageSize }),
          ...(params?.search && { search: params.search }),
          ...(params?.status && { status: params.status }),
          ...(params?.type && { type: params.type }),
          ...(params?.sortBy && { sortBy: params.sortBy }),
        },
      }),
    ) as ListStoriesResponse
  },

  async get(id: string): Promise<{ story: PublicStory }> {
    return unwrap(await getStoriesById({ path: { id } })) as { story: PublicStory }
  },

  async getWithStructure(id: string): Promise<{ story: StoryWithStructure }> {
    return unwrap(await getStoriesByIdStructure({ path: { id } })) as { story: StoryWithStructure }
  },

  async getChapter(storyId: string, chapterId: string): Promise<{ chapter: ChapterContent }> {
    return unwrap(
      await getStoriesByIdChaptersByChapterId({ path: { id: storyId, chapterId } }),
    ) as { chapter: ChapterContent }
  },
}

// ---------------------------------------------------------------------------
// Announcements — endpoint is not yet defined on the backend; gracefully
// return an empty list so consumers don't blow up.
// ---------------------------------------------------------------------------

export const announcementsApi = {
  async list(): Promise<{ announcements: Announcement[] }> {
    return { announcements: [] }
  },
}

// ---------------------------------------------------------------------------
// Bookshelf
// ---------------------------------------------------------------------------

export const bookshelfApi = {
  /** List the current user's saved stories, optionally filtered by kind. */
  async list(params?: { kind?: SavedKind; cookie?: string }): Promise<{ stories: BookshelfStory[] }> {
    return unwrap(
      await getMyBookshelf({
        query: params?.kind ? { kind: params.kind } : undefined,
        headers: ssrHeaders(params?.cookie),
      }),
    ) as { stories: BookshelfStory[] }
  },

  /** Per-story status snapshot — booleans for each kind. */
  async status(storyId: string, cookie?: string): Promise<BookshelfStatus> {
    return unwrap(
      await getMyBookshelfByStoryId({
        path: { storyId },
        headers: ssrHeaders(cookie),
      }),
    ) as BookshelfStatus
  },

  /** Add a story to the shelf. Idempotent server-side. */
  async add(storyId: string, kind: SavedKind): Promise<{ success: true }> {
    return unwrap(await postMyBookshelf({ body: { storyId, kind } })) as { success: true }
  },

  /** Remove one (storyId, kind) entry. Idempotent server-side. */
  async remove(storyId: string, kind: SavedKind): Promise<{ success: true }> {
    return unwrap(
      await deleteMyBookshelfByStoryIdByKind({ path: { storyId, kind } }),
    ) as { success: true }
  },
}

// ---------------------------------------------------------------------------
// Authors (public)
// ---------------------------------------------------------------------------

export interface AuthorSummary {
  id: number
  username: string
  avatarUrl: string | null
  storyCount: number
}

export interface AuthorWithStories {
  author: AuthorSummary
  stories: PublicStory[]
}

export const authorsApi = {
  async list(params?: { search?: string; cookie?: string }): Promise<{ authors: AuthorSummary[] }> {
    return unwrap(
      await getAuthors({
        query: params?.search ? { search: params.search } : undefined,
        headers: ssrHeaders(params?.cookie),
      }),
    ) as { authors: AuthorSummary[] }
  },

  async get(id: number, cookie?: string): Promise<AuthorWithStories> {
    return unwrap(
      await getAuthorsById({ path: { id }, headers: ssrHeaders(cookie) }),
    ) as AuthorWithStories
  },
}

// ---------------------------------------------------------------------------
// My Fiction — slim "stories I own" view, with cover art so we can deep-link
// to the writer for editing.
// ---------------------------------------------------------------------------

export interface MyFictionStory {
  id: string
  name: string
  summary: string | null
  updatedAt: string
  characterCount: number
  chapterCount: number
  messageCount: number
  coverArtUrl: string | null
}

export interface MyFictionListResponse {
  stories: MyFictionStory[]
  pagination: Pagination
}

export const myFictionApi = {
  async list(params?: { page?: number; pageSize?: number; search?: string; cookie?: string }): Promise<MyFictionListResponse> {
    return unwrap(
      await getMyStories({
        query: {
          ...(params?.page !== undefined && { page: params.page }),
          ...(params?.pageSize !== undefined && { pageSize: params.pageSize }),
          ...(params?.search && { search: params.search }),
        },
        headers: ssrHeaders(params?.cookie),
      }),
    ) as MyFictionListResponse
  },
}

// ---------------------------------------------------------------------------
// Settings (password change)
// ---------------------------------------------------------------------------

export const settingsApi = {
  async changePassword(currentPassword: string, newPassword: string): Promise<{ success: true }> {
    return unwrap(
      await postAuthChangePassword({ body: { currentPassword, newPassword } }),
    ) as { success: true }
  },
}

// ---------------------------------------------------------------------------
// Reading history
// ---------------------------------------------------------------------------

export interface ReadingStatusEntry {
  story: PublicStory
  lastChapterId: string | null
  lastChapterReadAt: string | null
}

export interface ReadingStatusForStory {
  lastChapterId: string | null
  lastChapterReadAt: string | null
}

export const readingStatusApi = {
  async list(cookie?: string): Promise<{ entries: ReadingStatusEntry[] }> {
    return unwrap(
      await getMyReadingStatus({ headers: ssrHeaders(cookie) }),
    ) as { entries: ReadingStatusEntry[] }
  },

  async forStory(storyId: string, cookie?: string): Promise<ReadingStatusForStory> {
    return unwrap(
      await getMyReadingStatusByStoryId({ path: { storyId }, headers: ssrHeaders(cookie) }),
    ) as ReadingStatusForStory
  },

  async record(storyId: string, chapterId: string): Promise<{ success: true }> {
    return unwrap(
      await postMyReadingStatus({ body: { storyId, chapterId } }),
    ) as { success: true }
  },
}

