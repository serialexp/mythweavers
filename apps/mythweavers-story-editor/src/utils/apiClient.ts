import { ApiStory, ApiStoryMetadata, VersionConflictError } from '../types/api'
import { Node } from '../types/core'

// Re-export for backward compatibility
export type { ApiStory, ApiStoryMetadata }

// OLD API CLIENT - Should not be used anymore
// Hardcoded to port 3001 (old story-backend) to make it obvious when old endpoints are called
const getApiBaseUrl = () => {
  const hostname = window.location.hostname
  const protocol = window.location.protocol
  // Hardcoded to 3001 to catch any remaining old API calls
  return `${protocol}//${hostname}:3001/api`
}

class ApiClient {
  private getBaseUrl(): string {
    // Compute base URL dynamically each time to handle runtime changes
    return getApiBaseUrl()
  }

  get baseUrl(): string {
    return this.getBaseUrl()
  }

  async fetch(path: string, options?: RequestInit): Promise<Response> {
    const url = `${this.baseUrl}${path}`

    try {
      const response = await fetch(url, {
        ...options,
        credentials: 'include', // Include cookies in requests
      })

      // Check if response is HTML (common for default 404 pages)
      const contentType = response.headers.get('content-type')
      if (!response.ok && contentType && contentType.includes('text/html')) {
        console.warn('[ApiClient.fetch] Got HTML response for API call - likely a default 404 page')
        console.warn('[ApiClient.fetch] This usually means the backend is not running or the route is incorrect')
      }

      return response
    } catch (error) {
      console.error('[ApiClient.fetch] Error in native fetch:', error)
      console.error('[ApiClient.fetch] Error type:', typeof error)
      console.error('[ApiClient.fetch] Error name:', error instanceof Error ? error.name : 'Unknown')
      console.error('[ApiClient.fetch] Error message:', error instanceof Error ? error.message : String(error))
      console.error('[ApiClient.fetch] Error stack:', error instanceof Error ? error.stack : 'No stack trace')

      // Check if it's a network error
      if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
        console.error('[ApiClient.fetch] Network error - backend might not be running')
        console.error('[ApiClient.fetch] Expected backend URL:', this.baseUrl)
      }

      throw error
    }
  }

  async get<T = any>(path: string): Promise<{ data: T; status: number }> {
    const response = await this.fetch(path)
    if (!response.ok) {
      throw new Error(`GET ${path} failed with status ${response.status}`)
    }
    const data = await response.json()
    return { data, status: response.status }
  }

  async post<T = any>(path: string, body: any): Promise<{ data: T; status: number }> {
    const response = await this.fetch(path, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })
    if (!response.ok) {
      throw new Error(`POST ${path} failed with status ${response.status}`)
    }
    const data = await response.json()
    return { data, status: response.status }
  }

  async put<T = any>(path: string, body: any): Promise<{ data: T; status: number }> {
    const response = await this.fetch(path, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })
    if (!response.ok) {
      throw new Error(`PUT ${path} failed with status ${response.status}`)
    }
    const data = await response.json()
    return { data, status: response.status }
  }

  async delete<T = any>(path: string): Promise<{ data: T; status: number }> {
    const response = await this.fetch(path, {
      method: 'DELETE',
    })
    if (!response.ok) {
      throw new Error(`DELETE ${path} failed with status ${response.status}`)
    }
    const data = await response.json()
    return { data, status: response.status }
  }

  async healthCheck(): Promise<{
    available: boolean
    status?: string
    timestamp?: string
    authenticated?: boolean
    sessionValid?: boolean
  }> {
    try {
      const response = await this.fetch('/health')
      if (response.ok) {
        const data = await response.json()
        return { available: true, ...data }
      }
      return { available: false }
    } catch (_error) {
      return { available: false }
    }
  }

  async getStories(): Promise<ApiStoryMetadata[]> {
    const response = await this.fetch('/stories')
    if (!response.ok) {
      throw new Error('Failed to fetch stories')
    }
    return response.json()
  }

  async getStory(id: string): Promise<ApiStory> {
    const response = await this.fetch(`/stories/${id}`)
    if (!response.ok) {
      throw new Error('Failed to fetch story')
    }
    return response.json()
  }

  async createStory(data: {
    name: string
    messages: any[]
    characters: any[]
    contextItems?: any[]
    input?: string
    storySetting?: string
    person?: 'first' | 'second' | 'third'
    tense?: 'present' | 'past'
    globalScript?: string
    calendarPresetId?: string
  }): Promise<ApiStory> {
    const response = await this.fetch('/stories', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    })
    if (!response.ok) {
      throw new Error('Failed to create story')
    }
    return response.json()
  }

  async updateStory(
    id: string,
    data: {
      name: string
      messages: any[]
      characters: any[]
      contextItems?: any[]
      input?: string
      storySetting?: string
      person?: 'first' | 'second' | 'third'
      tense?: 'present' | 'past'
      globalScript?: string
      lastKnownUpdatedAt?: string
      force?: boolean
    },
  ): Promise<ApiStory> {
    const response = await this.fetch(`/stories/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    })

    if (response.status === 409) {
      // Conflict - server version is newer
      const errorData = await response.json()
      throw new VersionConflictError(
        errorData.error || 'Version conflict',
        errorData.serverUpdatedAt,
        errorData.clientUpdatedAt,
      )
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Failed to update story' }))
      throw new Error(errorData.error || 'Failed to update story')
    }
    return response.json()
  }

  async downloadStoryAsPdf(id: string, filename: string): Promise<void> {
    const response = await this.fetch(`/stories/${id}/pdf`)
    if (!response.ok) {
      throw new Error('Failed to generate PDF')
    }

    const blob = await response.blob()
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.style.display = 'none'
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    window.URL.revokeObjectURL(url)
    document.body.removeChild(a)
  }

  async deleteStory(id: string): Promise<{ success: boolean }> {
    const response = await this.fetch(`/stories/${id}`, {
      method: 'DELETE',
    })
    if (!response.ok) {
      throw new Error('Failed to delete story')
    }
    return response.json()
  }

  async getDeletedMessages(
    storyId: string,
    limit = 20,
  ): Promise<
    Array<{
      id: string
      content: string
      instruction?: string
      timestamp: string
      model?: string
      totalTokens?: number
      order: number
    }>
  > {
    const response = await this.fetch(`/stories/${storyId}/deleted-messages?limit=${limit}`)
    if (!response.ok) {
      throw new Error('Failed to fetch deleted messages')
    }
    return response.json()
  }

  async restoreMessage(storyId: string, messageId: string): Promise<any> {
    const response = await this.fetch(`/stories/${storyId}/messages/${messageId}/restore`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    })
    if (!response.ok) {
      throw new Error('Failed to restore message')
    }
    return response.json()
  }

  // Single message operations for granular saves
  async insertMessage(storyId: string, afterMessageId: string | null, messageData: any): Promise<any> {
    const afterId = afterMessageId || 'null'
    const response = await this.fetch(`/stories/${storyId}/messages/${afterId}/insert`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(messageData),
    })
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Failed to insert message' }))
      throw new Error(errorData.error || `Failed to insert message: ${response.status} ${response.statusText}`)
    }
    return response.json()
  }

  async updateMessage(storyId: string, messageId: string, messageData: any): Promise<any> {
    const response = await this.fetch(`/stories/${storyId}/messages/${messageId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(messageData),
    })
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Failed to update message' }))
      throw new Error(errorData.error || `Failed to update message: ${response.status} ${response.statusText}`)
    }
    return response.json()
  }

  async deleteMessage(storyId: string, messageId: string): Promise<any> {
    const response = await this.fetch(`/stories/${storyId}/messages/${messageId}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
    })
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Failed to delete message' }))
      throw new Error(errorData.error || `Failed to delete message: ${response.status} ${response.statusText}`)
    }
    return response.json()
  }

  async reorderMessages(
    storyId: string,
    data: { items: Array<{ messageId: string; nodeId: string; order: number }> },
  ): Promise<any> {
    const response = await this.fetch(`/stories/${storyId}/messages/reorder`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ storyId, ...data }),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Failed to reorder messages' }))
      throw new Error(errorData.error || `Failed to reorder messages: ${response.status} ${response.statusText}`)
    }

    return response.json()
  }

  async semanticSearchMessages(
    storyId: string,
    query: string,
    options: { limit?: number; minScore?: number } = {},
  ): Promise<any> {
    const params = new URLSearchParams({ q: query })
    if (options.limit !== undefined) {
      params.set('limit', String(options.limit))
    }
    if (options.minScore !== undefined) {
      params.set('minScore', String(options.minScore))
    }

    const response = await this.fetch(`/stories/${storyId}/messages/search/semantic?${params.toString()}`)
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Failed to run semantic search' }))
      throw new Error(errorData.error || `Failed to run semantic search: ${response.status} ${response.statusText}`)
    }
    return response.json()
  }

  // Single chapter operations for granular saves
  async updateChapter(storyId: string, chapterId: string, chapterData: any): Promise<any> {
    const response = await this.fetch(`/stories/${storyId}/chapters/${chapterId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(chapterData),
    })
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Failed to update chapter' }))
      throw new Error(errorData.error || `Failed to update chapter: ${response.status} ${response.statusText}`)
    }
    return response.json()
  }

  async deleteChapter(storyId: string, chapterId: string): Promise<any> {
    const response = await this.fetch(`/stories/${storyId}/chapters/${chapterId}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
    })
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Failed to delete chapter' }))
      throw new Error(errorData.error || `Failed to delete chapter: ${response.status} ${response.statusText}`)
    }
    return response.json()
  }

  // Map operations
  async getMaps(storyId: string): Promise<any[]> {
    const response = await this.fetch(`/stories/${storyId}/maps`)
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Failed to fetch maps' }))
      throw new Error(errorData.error || `Failed to fetch maps: ${response.status} ${response.statusText}`)
    }
    return response.json()
  }

  async getMapImage(mapId: string): Promise<{ imageData: string | null }> {
    const response = await this.fetch(`/maps/${mapId}/image`)
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Failed to fetch map image' }))
      throw new Error(errorData.error || `Failed to fetch map image: ${response.status} ${response.statusText}`)
    }
    return response.json()
  }

  async getMapLandmarks(mapId: string): Promise<any[]> {
    const response = await this.fetch(`/maps/${mapId}/landmarks`)
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Failed to fetch landmarks' }))
      throw new Error(errorData.error || `Failed to fetch landmarks: ${response.status} ${response.statusText}`)
    }
    return response.json()
  }

  async getMapHyperlanes(mapId: string): Promise<any[]> {
    const response = await this.fetch(`/maps/${mapId}/hyperlanes`)
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Failed to fetch hyperlanes' }))
      throw new Error(errorData.error || `Failed to fetch hyperlanes: ${response.status} ${response.statusText}`)
    }
    return response.json()
  }

  async getMapFleets(mapId: string): Promise<any[]> {
    const response = await this.fetch(`/maps/${mapId}/fleets`)
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Failed to fetch fleets' }))
      throw new Error(errorData.error || `Failed to fetch fleets: ${response.status} ${response.statusText}`)
    }
    return response.json()
  }

  async createMap(storyId: string, mapData: any): Promise<any> {
    const response = await this.fetch(`/stories/${storyId}/maps`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(mapData),
    })
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Failed to create map' }))
      throw new Error(errorData.error || `Failed to create map: ${response.status} ${response.statusText}`)
    }
    return response.json()
  }

  async updateMap(storyId: string, mapId: string, mapData: any): Promise<any> {
    const response = await this.fetch(`/stories/${storyId}/maps/${mapId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(mapData),
    })
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Failed to update map' }))
      throw new Error(errorData.error || `Failed to update map: ${response.status} ${response.statusText}`)
    }
    return response.json()
  }

  async deleteMap(storyId: string, mapId: string): Promise<any> {
    const response = await this.fetch(`/stories/${storyId}/maps/${mapId}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
    })
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Failed to delete map' }))
      throw new Error(errorData.error || `Failed to delete map: ${response.status} ${response.statusText}`)
    }
    return response.json()
  }

  // Landmark operations
  async createLandmark(storyId: string, mapId: string, landmarkData: any): Promise<any> {
    const response = await this.fetch(`/stories/${storyId}/maps/${mapId}/landmarks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(landmarkData),
    })
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Failed to create landmark' }))
      throw new Error(errorData.error || `Failed to create landmark: ${response.status} ${response.statusText}`)
    }
    return response.json()
  }

  async updateLandmark(storyId: string, mapId: string, landmarkId: string, landmarkData: any): Promise<any> {
    const response = await this.fetch(`/stories/${storyId}/maps/${mapId}/landmarks/${landmarkId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(landmarkData),
    })
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Failed to update landmark' }))
      throw new Error(errorData.error || `Failed to update landmark: ${response.status} ${response.statusText}`)
    }
    return response.json()
  }

  async deleteLandmark(storyId: string, mapId: string, landmarkId: string): Promise<any> {
    const response = await this.fetch(`/stories/${storyId}/maps/${mapId}/landmarks/${landmarkId}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
    })
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Failed to delete landmark' }))
      throw new Error(errorData.error || `Failed to delete landmark: ${response.status} ${response.statusText}`)
    }
    return response.json()
  }

  // Fleet operations
  async createFleet(storyId: string, mapId: string, fleetData: any): Promise<any> {
    const response = await this.fetch(`/stories/${storyId}/maps/${mapId}/fleets`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(fleetData),
    })
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Failed to create fleet' }))
      throw new Error(errorData.error || `Failed to create fleet: ${response.status} ${response.statusText}`)
    }
    return response.json()
  }

  async updateFleet(storyId: string, mapId: string, fleetId: string, fleetData: any): Promise<any> {
    const response = await this.fetch(`/stories/${storyId}/maps/${mapId}/fleets/${fleetId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(fleetData),
    })
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Failed to update fleet' }))
      throw new Error(errorData.error || `Failed to update fleet: ${response.status} ${response.statusText}`)
    }
    return response.json()
  }

  async deleteFleet(storyId: string, mapId: string, fleetId: string): Promise<any> {
    const response = await this.fetch(`/stories/${storyId}/maps/${mapId}/fleets/${fleetId}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
    })
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Failed to delete fleet' }))
      throw new Error(errorData.error || `Failed to delete fleet: ${response.status} ${response.statusText}`)
    }
    return response.json()
  }

  async createFleetMovement(storyId: string, mapId: string, fleetId: string, movementData: any): Promise<any> {
    const response = await this.fetch(`/stories/${storyId}/maps/${mapId}/fleets/${fleetId}/movements`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(movementData),
    })
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Failed to create fleet movement' }))
      throw new Error(errorData.error || `Failed to create fleet movement: ${response.status} ${response.statusText}`)
    }
    return response.json()
  }

  async updateFleetMovement(
    storyId: string,
    mapId: string,
    fleetId: string,
    movementId: string,
    movementData: any,
  ): Promise<any> {
    const response = await this.fetch(`/stories/${storyId}/maps/${mapId}/fleets/${fleetId}/movements/${movementId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(movementData),
    })
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Failed to update fleet movement' }))
      throw new Error(errorData.error || `Failed to update fleet movement: ${response.status} ${response.statusText}`)
    }
    return response.json()
  }

  async deleteFleetMovement(storyId: string, mapId: string, fleetId: string, movementId: string): Promise<any> {
    const response = await this.fetch(`/stories/${storyId}/maps/${mapId}/fleets/${fleetId}/movements/${movementId}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
    })
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Failed to delete fleet movement' }))
      throw new Error(errorData.error || `Failed to delete fleet movement: ${response.status} ${response.statusText}`)
    }
    return response.json()
  }

  // Hyperlane operations
  async createHyperlane(storyId: string, mapId: string, hyperlaneData: any): Promise<any> {
    const response = await this.fetch(`/stories/${storyId}/maps/${mapId}/hyperlanes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(hyperlaneData),
    })
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Failed to create hyperlane' }))
      throw new Error(errorData.error || `Failed to create hyperlane: ${response.status} ${response.statusText}`)
    }
    return response.json()
  }

  async updateHyperlane(storyId: string, mapId: string, hyperlaneId: string, hyperlaneData: any): Promise<any> {
    const response = await this.fetch(`/stories/${storyId}/maps/${mapId}/hyperlanes/${hyperlaneId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(hyperlaneData),
    })
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Failed to update hyperlane' }))
      throw new Error(errorData.error || `Failed to update hyperlane: ${response.status} ${response.statusText}`)
    }
    return response.json()
  }

  async deleteHyperlane(storyId: string, mapId: string, hyperlaneId: string): Promise<any> {
    const response = await this.fetch(`/stories/${storyId}/maps/${mapId}/hyperlanes/${hyperlaneId}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
    })
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Failed to delete hyperlane' }))
      throw new Error(errorData.error || `Failed to delete hyperlane: ${response.status} ${response.statusText}`)
    }
    return response.json()
  }

  // Node operations
  async getNodes(storyId: string): Promise<Node[]> {
    const response = await this.fetch(`/stories/${storyId}/nodes`)
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Failed to fetch nodes' }))
      throw new Error(errorData.error || `Failed to fetch nodes: ${response.status} ${response.statusText}`)
    }
    return response.json()
  }

  async createNode(storyId: string, nodeData: Node): Promise<any> {
    const response = await this.fetch(`/stories/${storyId}/nodes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(nodeData),
    })
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Failed to create node' }))
      throw new Error(errorData.error || `Failed to create node: ${response.status} ${response.statusText}`)
    }
    return response.json()
  }

  async updateNode(storyId: string, nodeId: string, nodeData: Partial<Node>): Promise<any> {
    const response = await this.fetch(`/stories/${storyId}/nodes/${nodeId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(nodeData),
    })
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Failed to update node' }))
      throw new Error(errorData.error || `Failed to update node: ${response.status} ${response.statusText}`)
    }
    return response.json()
  }

  async deleteNode(storyId: string, nodeId: string): Promise<any> {
    const response = await this.fetch(`/stories/${storyId}/nodes/${nodeId}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
    })
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Failed to delete node' }))
      throw new Error(errorData.error || `Failed to delete node: ${response.status} ${response.statusText}`)
    }
    return response.json()
  }

  async updateNodesBulk(storyId: string, nodes: Node[]): Promise<any> {
    const response = await this.fetch(`/stories/${storyId}/nodes/bulk`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ nodes }),
    })
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Failed to bulk update nodes' }))
      throw new Error(errorData.error || `Failed to bulk update nodes: ${response.status} ${response.statusText}`)
    }
    return response.json()
  }

  // Landmark State operations
  async getLandmarkStates(storyId: string, filters?: { messageId?: string; mapId?: string }): Promise<any[]> {
    const params = new URLSearchParams()
    if (filters?.messageId) params.append('messageId', filters.messageId)
    if (filters?.mapId) params.append('mapId', filters.mapId)

    const url = `/stories/${storyId}/landmark-states${params.toString() ? `?${params.toString()}` : ''}`
    const response = await this.fetch(url)
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Failed to fetch landmark states' }))
      throw new Error(errorData.error || `Failed to fetch landmark states: ${response.status} ${response.statusText}`)
    }
    return response.json()
  }

  async getAccumulatedStates(storyId: string, messageId: string, mapId?: string): Promise<any[]> {
    const params = new URLSearchParams()
    if (mapId) params.append('mapId', mapId)

    const url = `/stories/${storyId}/landmark-states/accumulated/${messageId}${params.toString() ? `?${params.toString()}` : ''}`
    const response = await this.fetch(url)
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Failed to fetch accumulated states' }))
      throw new Error(
        errorData.error || `Failed to fetch accumulated states: ${response.status} ${response.statusText}`,
      )
    }
    return response.json()
  }

  async setLandmarkState(
    storyId: string,
    state: {
      mapId: string
      landmarkId: string
      messageId: string
      field: string
      value: string | null
    },
  ): Promise<any> {
    const response = await this.fetch(`/stories/${storyId}/landmark-states`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(state),
    })
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Failed to set landmark state' }))
      throw new Error(errorData.error || `Failed to set landmark state: ${response.status} ${response.statusText}`)
    }
    return response.json()
  }

  async batchSetLandmarkStates(
    storyId: string,
    states: Array<{
      mapId: string
      landmarkId: string
      messageId: string
      field: string
      value: string | null
    }>,
  ): Promise<any[]> {
    const response = await this.fetch(`/stories/${storyId}/landmark-states/batch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ states }),
    })
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Failed to batch set landmark states' }))
      throw new Error(
        errorData.error || `Failed to batch set landmark states: ${response.status} ${response.statusText}`,
      )
    }
    return response.json()
  }

  // Character operations for granular saves
  async createCharacter(storyId: string, characterData: any): Promise<any> {
    const response = await this.fetch(`/stories/${storyId}/characters`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(characterData),
    })
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Failed to create character' }))
      throw new Error(errorData.error || `Failed to create character: ${response.status} ${response.statusText}`)
    }
    return response.json()
  }

  async updateCharacter(storyId: string, characterId: string, characterData: any): Promise<any> {
    const response = await this.fetch(`/stories/${storyId}/characters/${characterId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(characterData),
    })
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Failed to update character' }))
      throw new Error(errorData.error || `Failed to update character: ${response.status} ${response.statusText}`)
    }
    return response.json()
  }

  async deleteCharacter(storyId: string, characterId: string): Promise<any> {
    const response = await this.fetch(`/stories/${storyId}/characters/${characterId}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
    })
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Failed to delete character' }))
      throw new Error(errorData.error || `Failed to delete character: ${response.status} ${response.statusText}`)
    }
    return response.json()
  }

  // Context item operations for granular saves
  async updateContextItem(storyId: string, itemId: string, itemData: any): Promise<any> {
    const response = await this.fetch(`/stories/${storyId}/context-items/${itemId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(itemData),
    })
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Failed to update context item' }))
      throw new Error(errorData.error || `Failed to update context item: ${response.status} ${response.statusText}`)
    }
    return response.json()
  }

  async deleteContextItem(storyId: string, itemId: string): Promise<any> {
    const response = await this.fetch(`/stories/${storyId}/context-items/${itemId}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
    })
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Failed to delete context item' }))
      throw new Error(errorData.error || `Failed to delete context item: ${response.status} ${response.statusText}`)
    }
    return response.json()
  }

  // Update story settings (partial update)
  async updateStorySettings(
    storyId: string,
    settings: Partial<{
      name: string
      person: 'first' | 'second' | 'third'
      tense: 'present' | 'past'
      storySetting: string
      globalScript: string
      branchChoices: Record<string, string>
      timelineStartTime: number | undefined
      timelineEndTime: number | undefined
      timelineGranularity: 'hour' | 'day'
    }>,
  ): Promise<any> {
    const response = await this.fetch(`/stories/${storyId}/settings`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(settings),
    })
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Failed to update story settings' }))
      throw new Error(errorData.error || `Failed to update story settings: ${response.status} ${response.statusText}`)
    }
    return response.json()
  }

  // Auth methods
  async register(
    email: string,
    username: string,
    password: string,
  ): Promise<{ success: boolean; user?: any; error?: string }> {
    try {
      const response = await this.fetch('/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, username, password }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Registration failed' }))
        return { success: false, error: errorData.error }
      }

      const data = await response.json()
      return { success: true, user: data.user }
    } catch (error) {
      console.error('[ApiClient] Registration error:', error)
      return { success: false, error: 'Network error during registration' }
    }
  }

  async login(username: string, password: string): Promise<{ success: boolean; user?: any; error?: string }> {
    try {
      const response = await this.fetch('/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Login failed' }))
        return { success: false, error: errorData.error }
      }

      const data = await response.json()
      return { success: true, user: data.user }
    } catch (error) {
      console.error('[ApiClient] Login error:', error)
      return { success: false, error: 'Network error during login' }
    }
  }

  async logout(): Promise<{ success: boolean }> {
    try {
      const response = await this.fetch('/auth/logout', {
        method: 'POST',
      })

      return { success: response.ok }
    } catch (error) {
      console.error('[ApiClient] Logout error:', error)
      return { success: false }
    }
  }

  async requestPasswordReset(email: string): Promise<{ success: boolean; message?: string; error?: string }> {
    try {
      const response = await this.fetch('/auth/request-password-reset', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      })

      const data = await response.json()

      if (!response.ok) {
        return { success: false, error: data.error || 'Failed to request password reset' }
      }

      return { success: true, message: data.message }
    } catch (error) {
      console.error('[ApiClient] Request password reset error:', error)
      return { success: false, error: 'Failed to connect to server' }
    }
  }

  async resetPassword(
    token: string,
    newPassword: string,
  ): Promise<{ success: boolean; message?: string; error?: string }> {
    try {
      const response = await this.fetch('/auth/reset-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token, newPassword }),
      })

      const data = await response.json()

      if (!response.ok) {
        return { success: false, error: data.error || 'Failed to reset password' }
      }

      return { success: true, message: data.message }
    } catch (error) {
      console.error('[ApiClient] Reset password error:', error)
      return { success: false, error: 'Failed to connect to server' }
    }
  }

  async validateResetToken(
    token: string,
  ): Promise<{ valid: boolean; email?: string; username?: string; error?: string }> {
    try {
      const response = await this.fetch(`/auth/validate-reset-token/${token}`)

      const data = await response.json()

      if (!response.ok) {
        return { valid: false, error: data.error || 'Invalid token' }
      }

      return { valid: true, email: data.email, username: data.username }
    } catch (error) {
      console.error('[ApiClient] Validate reset token error:', error)
      return { valid: false, error: 'Failed to connect to server' }
    }
  }

  async checkSession(): Promise<{ authenticated: boolean; user?: any }> {
    try {
      const response = await this.fetch('/auth/session')

      if (!response.ok) {
        return { authenticated: false }
      }

      const data = await response.json()
      return data
    } catch (error) {
      console.error('[ApiClient] Session check error:', error)
      return { authenticated: false }
    }
  }
}

export const apiClient = new ApiClient()
