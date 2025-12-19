import { EventEmitter } from 'node:events'
import Redis from 'ioredis'
import { createLogger } from './logger'

export type StoryEventName =
  | 'message:updated'
  | 'message:created'
  | 'message:deleted'
  | 'node:created'
  | 'node:updated'
  | 'node:deleted'
  | 'story:reloaded'

export interface StoryEvent {
  type: StoryEventName
  storyId: string
  payload: Record<string, unknown>
}

const CHANNEL = process.env.STORY_EVENT_CHANNEL ?? process.env.EVENT_BUS_CHANNEL ?? 'story:events'
const redisUrl = process.env.STORY_EVENT_REDIS_URL ?? process.env.EVENT_BUS_REDIS_URL ?? process.env.REDIS_URL
const CONNECT_TIMEOUT = Number.parseInt(process.env.STORY_EVENT_REDIS_CONNECT_TIMEOUT_MS ?? '1000', 10) || 1000

const log = createLogger('eventBus')
const localEmitter = new EventEmitter()

let publisher: Redis | null = null
let subscriber: Redis | null = null
let subscriberReady = false
let subscriberHandlersAttached = false
let warnedAboutMissingRedis = false
let subscriberConnectPromise: Promise<void> | null = null

const LOCAL_EVENT = 'story-event'

function createRedisClient(role: 'publisher' | 'subscriber'): Redis | null {
  if (!redisUrl) {
    return null
  }

  const client = new Redis(redisUrl, {
    maxRetriesPerRequest: 3,
    enableOfflineQueue: false,
    lazyConnect: true,
    connectTimeout: CONNECT_TIMEOUT,
  })

  client.on('error', (error) => {
    log.error({ err: error, role }, 'Redis connection error')
  })

  client.on('connect', () => {
    log.debug({ role }, 'Redis connection established')
  })

  client.on('close', () => {
    log.debug({ role }, 'Redis connection closed')
    if (role === 'subscriber') {
      subscriberReady = false
    }
  })

  return client
}

async function connectWithTimeout(client: Redis, role: 'publisher' | 'subscriber'): Promise<boolean> {
  const status = client.status as unknown as string

  // If already ready, return immediately
  if (status === 'ready') {
    return true
  }

  // If already connecting, wait for ready or close event
  if (status === 'connecting' || status === 'connect') {
    return new Promise<boolean>((resolve) => {
      const onReady = () => {
        cleanup()
        resolve(true)
      }
      const onClose = () => {
        cleanup()
        resolve(false)
      }
      const onError = () => {
        cleanup()
        resolve(false)
      }
      const cleanup = () => {
        client.off('ready', onReady)
        client.off('close', onClose)
        client.off('error', onError)
      }

      client.once('ready', onReady)
      client.once('close', onClose)
      client.once('error', onError)

      // Check status immediately in case we missed the event
      if ((client.status as unknown as string) === 'ready') {
        cleanup()
        resolve(true)
      }
    })
  }

  let timeoutHandle: NodeJS.Timeout | undefined
  try {
    const connectPromise = client.connect()
    await Promise.race([
      connectPromise,
      new Promise<never>((_, reject) => {
        timeoutHandle = setTimeout(() => reject(new Error('Redis connect timeout')), CONNECT_TIMEOUT)
      }),
    ])
    return (client.status as unknown as string) === 'ready'
  } catch (error) {
    log.error({ err: error, role }, 'Failed to establish Redis connection')
    try {
      client.disconnect()
    } catch {
      // ignore disconnect errors
    }
    return false
  } finally {
    if (timeoutHandle) {
      clearTimeout(timeoutHandle)
    }
    if ((client.status as unknown as string) !== 'ready') {
      if (role === 'publisher') {
        publisher = null
      } else {
        subscriber = null
        subscriberReady = false
        subscriberHandlersAttached = false
        subscriberConnectPromise = null
      }
    }
  }
}

function getPublisher(): Redis | null {
  if (publisher) {
    return publisher
  }

  publisher = createRedisClient('publisher')
  return publisher
}

async function ensureSubscriber(): Promise<void> {
  // If already ready or no Redis URL, return immediately
  if (subscriberReady || !redisUrl) {
    return
  }

  // If already connecting, wait for that connection attempt to complete
  if (subscriberConnectPromise) {
    await subscriberConnectPromise
    return
  }

  // Start a new connection attempt
  subscriberConnectPromise = (async () => {
    try {
      if (!subscriber) {
        subscriber = createRedisClient('subscriber')
        if (!subscriber) {
          return
        }
      }

      const connected = await connectWithTimeout(subscriber, 'subscriber')
      if (!connected) {
        return
      }

      if (!subscriberHandlersAttached) {
        subscriber.on('message', (channel, message) => {
          if (channel !== CHANNEL) {
            return
          }

          try {
            const parsed = JSON.parse(message) as StoryEvent
            localEmitter.emit(LOCAL_EVENT, parsed)
          } catch (error) {
            log.error({ err: error, raw: message }, 'Failed to parse story event payload')
          }
        })
        subscriberHandlersAttached = true
      }

      try {
        await subscriber.subscribe(CHANNEL)
        subscriberReady = true
        log.debug({ channel: CHANNEL }, 'Subscribed to story events channel')
      } catch (error) {
        log.error({ err: error, channel: CHANNEL }, 'Failed to subscribe to story events')
      }
    } finally {
      subscriberConnectPromise = null
    }
  })()

  await subscriberConnectPromise
}

export function isRedisEventBusEnabled(): boolean {
  return Boolean(redisUrl)
}

export async function publishStoryEvent(event: StoryEvent): Promise<void> {
  if (!redisUrl) {
    if (!warnedAboutMissingRedis) {
      log.debug('Redis URL not configured; story events will only be delivered within the current process')
      warnedAboutMissingRedis = true
    }
    localEmitter.emit(LOCAL_EVENT, event)
    return
  }

  const client = getPublisher()
  if (!client) {
    log.error({ event }, 'Unable to obtain Redis publisher for story events')
    return
  }

  const connected = await connectWithTimeout(client, 'publisher')
  if (!connected) {
    localEmitter.emit(LOCAL_EVENT, event)
    return
  }

  try {
    await client.publish(CHANNEL, JSON.stringify(event))
    log.info(
      {
        eventType: event.type,
        storyId: event.storyId,
      },
      'Published story event to Redis',
    )
  } catch (error) {
    log.error({ err: error, event }, 'Failed to publish story event')
    localEmitter.emit(LOCAL_EVENT, event)
  }
}

export function subscribeToStoryEvents(handler: (event: StoryEvent) => void): () => void {
  void ensureSubscriber()

  localEmitter.on(LOCAL_EVENT, handler)

  return () => {
    localEmitter.off(LOCAL_EVENT, handler)
  }
}

export async function shutdownEventBus(): Promise<void> {
  const tasks: Array<Promise<unknown>> = []

  if (publisher) {
    tasks.push(publisher.quit().catch(() => publisher?.disconnect()))
    publisher = null
  }

  if (subscriber) {
    tasks.push(
      subscriber
        .unsubscribe(CHANNEL)
        .catch(() => undefined)
        .finally(() => subscriber?.quit().catch(() => subscriber?.disconnect())),
    )
    subscriber = null
    subscriberReady = false
    subscriberHandlersAttached = false
    subscriberConnectPromise = null
  }

  await Promise.all(tasks)
}
