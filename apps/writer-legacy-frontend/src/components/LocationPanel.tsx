import { convertFileSrc } from '@tauri-apps/api/core'
import { For, createSignal } from 'solid-js'
import { createLocation, locationsState, removeLocation, setSelectedLocationId } from '../lib/stores/locations'
import { storyState } from '../lib/stores/story'
import { LocationModal } from './LocationModal'
import { NoItems } from './NoItems'

export const LocationPanel = () => {
  const [locationModal, setLocationModal] = createSignal(false)
  const openPath = storyState.openPath
  const locations = locationsState.locations

  return (
    <div class="flex flex-col gap-2 p-2 w-full">
      {locationModal() && (
        <LocationModal
          onClose={() => {
            setLocationModal(false)
          }}
        />
      )}
      {Object.values(locations).length === 0 ? (
        <NoItems itemKind="locations" />
      ) : (
        <div class="flex-1 overflow-auto">
          <div class="flex flex-wrap items-start gap-2">
            <For each={Object.values(locations)}>
              {(location) => (
                <div
                  onClick={() => {
                    setLocationModal(true)
                    setSelectedLocationId(location.id)
                  }}
                  class="p-2 h-48 w-48 border border-black border-solid bg-gray-500"
                  style={{
                    'background-image': `url(${convertFileSrc(`${openPath}/data/${location.picture}`)})`,
                    'background-size': 'cover',
                    'background-position': 'center',
                  }}
                >
                  <div class="text-white text-shadow-2px-2px-3px-black text-lg font-bold">{location.name}</div>
                  <button
                    type="button"
                    class="btn btn-error btn-xs"
                    onClick={(e) => {
                      e.stopPropagation()
                      e.preventDefault()
                      removeLocation(location.id)
                    }}
                  >
                    X
                  </button>
                </div>
              )}
            </For>
          </div>
        </div>
      )}
      <button
        type="button"
        class="btn btn-primary"
        onClick={() => {
          const locationId = createLocation()
          setSelectedLocationId(locationId)
          setLocationModal(true)
        }}
      >
        Add location
      </button>
    </div>
  )
}
