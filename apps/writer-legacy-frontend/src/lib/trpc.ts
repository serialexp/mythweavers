import { createTRPCClient, httpBatchStreamLink } from '@trpc/client'
import type { AppRouter } from '@writer/legacy-backend'
import { getTokenForServer, settingsState } from './stores/settings'

export let trpc: ReturnType<typeof createTRPCClient<AppRouter>>
export let batchLink: ReturnType<typeof httpBatchStreamLink>

export const reloadTrpc = (passedServerUrl?: string) => {
  let serverUrl = passedServerUrl ?? settingsState.serverUrl
  if (!serverUrl) {
    serverUrl = 'https://writer.serial-experiments.com/trpc'
  }
  console.log('creating client', serverUrl)
  batchLink = httpBatchStreamLink({
    url: `${serverUrl}`,
    // You can pass any HTTP headers you wish here
    async headers() {
      // Use the new token system
      const token = getTokenForServer(serverUrl)

      return token
        ? {
            authorization: `Bearer ${token}`,
          }
        : {}
    },
  })

  trpc = createTRPCClient<AppRouter>({
    links: [batchLink],
  })
}

reloadTrpc()
