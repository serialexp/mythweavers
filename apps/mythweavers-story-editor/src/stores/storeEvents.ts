/**
 * Typed Event Bus for Store Communication
 *
 * This module provides a lightweight pub/sub system that allows stores
 * to communicate without importing each other directly. It has ZERO
 * store dependencies and sits at the foundation of the dependency graph.
 *
 * Architecture:
 *   Layer 0 (foundation) stores + this event bus
 *   Layer 1 (core domain) stores may import Layer 0
 *   Layer 2 (derived) stores may import Layer 0–1
 *   Layer 3 (aggregate) stores may import Layer 0–2
 *   Infrastructure (websocket, saveService) emits/consumes events
 *
 * Stores subscribe to events at module init time (safe — callbacks are
 * just registered, not invoked). Events fire later at runtime.
 */

// ── Event Definitions ──────────────────────────────────────────────

export interface StoreEventMap {
  // Story lifecycle
  'story:new': { storyId: string }
  'story:loaded': { storyId: string; storageMode: 'local' | 'server' }
  'story:cleared': void

  // Character changes (charactersStore → scriptDataStore)
  'characters:changed': void

  // WebSocket inbound events (websocket → messagesStore/nodeStore)
  'ws:message-updated': { storyId: string; message: any }
  'ws:message-created': { storyId: string; message: any; afterMessageId: string | null }
  'ws:message-deleted': { storyId: string; messageId: string }
  'ws:node-created': { storyId: string; node: unknown }
  'ws:node-updated': { storyId: string; node: unknown }
  'ws:node-deleted': { storyId: string; nodeId: string }
  'ws:story-reloaded': { storyId: string }

  // Save operation failures (saveService → mapsStore for rollback)
  'save:operation-failed': { operation: any; error: Error }
}

// ── Event Bus Implementation ───────────────────────────────────────

type EventHandler<T> = T extends void ? () => void : (payload: T) => void
type Unsubscribe = () => void

const listeners = new Map<string, Set<EventHandler<any>>>()

/** Subscribe to a typed event. Returns an unsubscribe function. */
export function on<K extends keyof StoreEventMap>(
  event: K,
  handler: EventHandler<StoreEventMap[K]>,
): Unsubscribe {
  if (!listeners.has(event)) {
    listeners.set(event, new Set())
  }
  listeners.get(event)!.add(handler)

  return () => {
    listeners.get(event)?.delete(handler)
  }
}

/** Emit a typed event to all subscribers. */
export function emit<K extends keyof StoreEventMap>(
  ...args: StoreEventMap[K] extends void ? [event: K] : [event: K, payload: StoreEventMap[K]]
): void {
  const [event, payload] = args as [K, StoreEventMap[K]?]
  const handlers = listeners.get(event)
  if (!handlers) return

  for (const handler of handlers) {
    try {
      ;(handler as any)(payload)
    } catch (err) {
      console.error(`[storeEvents] Error in handler for "${event}":`, err)
    }
  }
}

/** Remove all listeners (useful for testing). */
export function clearAllListeners(): void {
  listeners.clear()
}
