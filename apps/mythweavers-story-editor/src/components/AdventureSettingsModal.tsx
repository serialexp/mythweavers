import type { Component } from 'solid-js'
import { Modal } from '@mythweavers/ui'
import { adventureStore } from '../stores/adventureStore'
import { useEngine } from '../pages/adventure/useAdventureEngine'
import {
  AdventureSettings,
  type AdventureSettingsValues,
} from './AdventureSettings'

interface AdventureSettingsModalProps {
  open: boolean
  onClose: () => void
}

const SETTERS: Record<
  keyof AdventureSettingsValues,
  (value: boolean) => void
> = {
  autoAdvanceWorld: adventureStore.setAutoAdvanceWorld,
  nonsenseCheckEnabled: adventureStore.setNonsenseCheckEnabled,
  gateApprovalEnabled: adventureStore.setGateApprovalEnabled,
  steeringEnabled: adventureStore.setSteeringEnabled,
  directorEnabled: adventureStore.setDirectorEnabled,
  livingWorldEnabled: adventureStore.setLivingWorldEnabled,
  conditionTrackingEnabled: adventureStore.setConditionTrackingEnabled,
}

/**
 * In-adventure settings popup. Binds the shared AdventureSettings toggles to
 * the live adventure store and persists each change immediately (same as the
 * old inline toggles did).
 */
export const AdventureSettingsModal: Component<AdventureSettingsModalProps> = (
  props,
) => {
  const engine = useEngine()

  return (
    <Modal
      open={props.open}
      onClose={props.onClose}
      title="Adventure Settings"
      size="lg"
    >
      <AdventureSettings
        values={{
          autoAdvanceWorld: adventureStore.autoAdvanceWorld,
          nonsenseCheckEnabled: adventureStore.nonsenseCheckEnabled,
          gateApprovalEnabled: adventureStore.gateApprovalEnabled,
          steeringEnabled: adventureStore.steeringEnabled,
          directorEnabled: adventureStore.directorEnabled,
          livingWorldEnabled: adventureStore.livingWorldEnabled,
          conditionTrackingEnabled: adventureStore.conditionTrackingEnabled,
        }}
        onChange={(key, value) => {
          SETTERS[key](value)
          engine.persist()
        }}
      />
    </Modal>
  )
}
