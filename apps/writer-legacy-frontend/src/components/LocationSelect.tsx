import { Select } from '@thisbeyond/solid-select'
import '@thisbeyond/solid-select/style.css'
import { convertFileSrc } from '@tauri-apps/api/core'
import type { Location } from '@writer/shared'
import { locationsState } from '../lib/stores/locations'
import { storyState } from '../lib/stores/story'

type LocationSelectProps = {
  placeholder: string
  value?: string
  onChange: (locationId: string) => void
  locations?: string[]
  emptyMessage?: string
}

export const LocationSelect = (props: LocationSelectProps) => {
  const openPath = storyState.openPath
  const locations = () =>
    Object.values(locationsState.locations)
      .filter((loc) => {
        return !props.locations || props.locations.includes(loc.id)
      })
      .sort((a, b) => a.name.localeCompare(b.name))

  const getLocationImage = (location: Location) => {
    if (location.picture) {
      return convertFileSrc(`${openPath}/data/${location.picture}`)
    }
    return '/unknown-location.jpg'
  }

  const formatOption = (location: Location) => (
    <div class="flex items-center gap-3">
      <div
        class="w-8 h-8 rounded bg-cover bg-center border border-gray-300"
        style={{
          'background-image': `url(${getLocationImage(location)})`,
        }}
      />
      <span>{location.name}</span>
    </div>
  )

  return (
    <Select
      placeholder={props.placeholder}
      options={locations()}
      initialValue={props.value ? locationsState.locations[props.value] : undefined}
      onChange={(location) => {
        props.onChange(location ? location.id : '')
      }}
      format={formatOption}
    />
  )
}
