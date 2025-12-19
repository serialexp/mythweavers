import type { InventoryAction } from '@writer/shared'
import { createSignal } from 'solid-js'
import { items } from '../lib/stores/items'
import { currentScene } from '../lib/stores/retrieval/current-scene'
import { addInventoryActionToSceneParagraph } from '../lib/stores/scenes'
import { setShowInventory } from '../lib/stores/ui'
import {
  Combobox,
  ComboboxContent,
  ComboboxControl,
  ComboboxInput,
  ComboboxItem,
  ComboboxItemLabel,
  ComboboxTrigger,
} from '../solid-ui/combobox'
import {
  NumberField,
  NumberFieldDecrementTrigger,
  NumberFieldGroup,
  NumberFieldIncrementTrigger,
  NumberFieldInput,
} from '../solid-ui/number-field'

export const InventoryActions = () => {
  const [inventory, setInventory] = createSignal<InventoryAction>({
    type: 'add',
    item_name: '',
    item_amount: 1,
  })

  return (
    <div class="flex flex-row items-center gap-2">
      <div class="min-w-[6em]">Inventory</div>
      <button
        type="button"
        class="btn btn-outline"
        onClick={() => {
          setShowInventory(true)
        }}
      >
        Current
      </button>
      <select
        class="select select-bordered max-w-48"
        value={inventory().type}
        onChange={(e) => {
          setInventory((prev) => ({
            ...prev,
            type: e.currentTarget.value as 'add' | 'remove',
          }))
        }}
      >
        <option value="add">Add</option>
        <option value="remove">Remove</option>
      </select>
      <Combobox
        options={Object.values(items.items).map((item) => item.name)}
        value={inventory().item_name}
        onChange={(e) => {
          setInventory((prev) => ({
            ...prev,
            item_name: e ?? '',
          }))
        }}
        class="min-w-48"
        triggerMode="focus"
        itemComponent={(props) => {
          return (
            <ComboboxItem {...props}>
              <ComboboxItemLabel>{props.item.rawValue}</ComboboxItemLabel>
            </ComboboxItem>
          )
        }}
      >
        <ComboboxControl class="input input-bordered" aria-label="Food">
          <ComboboxInput />
          <ComboboxTrigger />
        </ComboboxControl>
        <ComboboxContent class="bg-base-100 max-h-64 overflow-y-auto" />
      </Combobox>
      <NumberField
        class="flex w-36 flex-col gap-2"
        onRawValueChange={(e) => {
          setInventory((prev) => ({
            ...prev,
            item_amount: e,
          }))
        }}
        value={inventory().item_amount}
        validationState={inventory().item_amount !== 40 ? 'invalid' : 'valid'}
      >
        <NumberFieldGroup>
          <NumberFieldInput />
          <NumberFieldIncrementTrigger />
          <NumberFieldDecrementTrigger />
        </NumberFieldGroup>
      </NumberField>

      <button
        type="button"
        class="btn btn-primary"
        onClick={() => {
          const currentSceneData = currentScene()
          if (currentSceneData && inventory() && currentSceneData.selectedParagraph) {
            addInventoryActionToSceneParagraph(currentSceneData.id, currentSceneData.selectedParagraph, inventory())
          }
        }}
      >
        Add
      </button>
    </div>
  )
}
