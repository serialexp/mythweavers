import KeyvRedis from '@keyv/redis'
import { createCache } from 'cache-manager'
import { Keyv } from 'keyv'

const keyv = new KeyvRedis({
  uri: process.env.REDIS_URL ?? 'redis://localhost:6379',
})

// Single store which is in memory
export const cache = createCache({
  stores: [
    new Keyv({
      store: keyv,
    }),
  ],
})
