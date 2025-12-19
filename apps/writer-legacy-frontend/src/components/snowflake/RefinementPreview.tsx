import { AutoResizeTextarea } from '../AutoResizeTextarea'

export const RefinementPreview = (props: {
  original: string
  refined: string
  onAccept: () => void
  onReject: () => void
}) => {
  return (
    <div class="grid grid-cols-2 gap-4">
      <div class="space-y-2">
        <div class="text-sm font-semibold">Original</div>
        <AutoResizeTextarea class="textarea textarea-bordered w-full" value={props.original} readonly />
      </div>
      <div class="space-y-2">
        <div class="text-sm font-semibold flex justify-between items-center">
          <span>Refined Version</span>
          <div class="space-x-2">
            <button type="button" class="btn btn-success btn-xs" onClick={props.onAccept}>
              Accept ✓
            </button>
            <button type="button" class="btn btn-error btn-xs" onClick={props.onReject}>
              Reject ✗
            </button>
          </div>
        </div>
        <AutoResizeTextarea class="textarea textarea-bordered w-full" value={props.refined} readonly />
      </div>
    </div>
  )
}
