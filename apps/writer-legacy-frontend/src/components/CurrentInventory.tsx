import { For } from 'solid-js'
import { getItemsAtParagraph } from '../lib/stores/retrieval/get-items-at-paragraph'

export const CurrentInventory = (props: {
  currentParagraphId: string
  onClose: () => void
}) => {
  const itemsUntilParagraph = getItemsAtParagraph(props.currentParagraphId)
  return (
    <div class="modal modal-open">
      <div class="modal-box">
        <h3 class="font-bold text-lg">Current Inventory</h3>
        <div class="py-4">
          <ul>
            <For each={Object.keys(itemsUntilParagraph ?? {})}>
              {(item) => {
                return (
                  <li>
                    {item} x{itemsUntilParagraph?.[item]}
                  </li>
                )
              }}
            </For>
          </ul>
        </div>
      </div>
      <div class="modal-backdrop" onClick={props.onClose} />
    </div>
  )
}
