import type { Location } from '@writer/shared'
import { generate as short } from 'short-uuid'
import { createStore } from 'solid-js/store'
import { removeEntityFromEmbeddingsCache } from '../embeddings/load-story-to-embeddings'

export const [locationsState, setLocationsState] = createStore<{
  locations: Record<string, Location>
  selectedLocationId: string
  selectedLocation?: Location
}>({
  selectedLocationId: '',
  locations: {},
  get selectedLocation() {
    return this.locations[this.selectedLocationId]
  },
})

export const createLocation = (data?: Partial<Location>) => {
  const id = short()
  setLocationsState('locations', (locations) => ({
    ...locations,
    [id]: {
      id,
      name: data?.name ?? '',
      picture: data?.picture ?? '',
      description: data?.description ?? '',
      modifiedAt: Date.now(),
    },
  }))
  return id
}

export const updateLocationProperty = <T extends keyof Location>(
  locationId: string,
  property: T,
  value: Location[T],
) => {
  setLocationsState('locations', locationId, (location) => ({
    ...location,
    [property]: value,
    modifiedAt: Date.now(),
  }))
  // Remove from embeddings cache when location is modified
  removeEntityFromEmbeddingsCache(`location/${locationId}`)
}

export const setSelectedLocationId = (locationId: string) => {
  setLocationsState('selectedLocationId', locationId)
}

export const removeLocation = (locationId: string) => {
  // Remove from embeddings cache when location is removed
  removeEntityFromEmbeddingsCache(`location/${locationId}`)
  // @ts-expect-error: yes, this is a valid operation
  setLocationsState('locations', locationId, undefined)
}
