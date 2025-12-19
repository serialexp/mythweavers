import { locationsState, updateLocationProperty } from '../lib/stores/locations'
import { FileSelector } from './FileSelector'

export const LocationModal = (props: {
  onClose: () => void
}) => {
  return (
    <div class="modal modal-open">
      <div class="modal-box">
        <h3 class="font-bold text-lg">
          Location {locationsState.selectedLocation?.name ?? locationsState.selectedLocation?.id}
        </h3>
        <div class="py-4">
          <div class="form-control">
            <label class="label">
              <span class="label-text">Name</span>
            </label>
            <input
              type="text"
              class="input input-bordered"
              value={locationsState.selectedLocation?.name ?? ''}
              onInput={(e) => {
                updateLocationProperty(locationsState.selectedLocationId, 'name', e.currentTarget.value)
              }}
            />
          </div>
          <div class="form-control">
            <label class="label">
              <span class="label-text">Picture</span>
            </label>
            <FileSelector
              name={locationsState.selectedLocation?.name ?? ''}
              value={locationsState.selectedLocation?.picture ?? ''}
              onChange={(file) => {
                updateLocationProperty(locationsState.selectedLocationId, 'picture', file)
              }}
            />
          </div>
          <div class="form-control">
            <label class="label">
              <span class="label-text">Description</span>
            </label>
            <textarea
              class="textarea textarea-bordered"
              value={locationsState.selectedLocation?.description ?? ''}
              onInput={(e) => {
                updateLocationProperty(locationsState.selectedLocationId, 'description', e.currentTarget.value)
              }}
            />
          </div>
        </div>
        <div class="modal-action">
          <button type="button" class="btn" onClick={props.onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
