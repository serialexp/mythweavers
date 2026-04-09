import { ListDetailPanel, type ListDetailPanelRef } from '@mythweavers/ui'
import { BsKey, BsLayers, BsPlug } from 'solid-icons/bs'
import { type Component, type JSX, onMount } from 'solid-js'
import { modelsStore } from '../stores/modelsStore'
import { settingsStore } from '../stores/settingsStore'
import { CategoryModelOverrides } from './CategoryModelOverrides'
import { CustomProviders } from './CustomProviders'
import { ModelSelector } from './ModelSelector'
import { ProviderSelector, ApiKeys } from './ProviderModelSelector'
import { OverlayPanel } from './OverlayPanel'
import * as styles from './Settings.css'

interface SettingsSection {
  id: string
  name: string
  icon: JSX.Element
}

const AI_SETTINGS_SECTIONS: SettingsSection[] = [
  { id: 'api-keys', name: 'API Keys', icon: <BsKey /> },
  { id: 'models', name: 'Models', icon: <BsLayers /> },
  { id: 'custom-providers', name: 'Custom Providers', icon: <BsPlug /> },
]

const AISettingsContent: Component = () => {
  let panelRef: ListDetailPanelRef | undefined

  onMount(() => {
    panelRef?.select('api-keys')
  })

  const renderModelsSection = () => (
    <div class={styles.section}>
      <ProviderSelector />

      <div class={styles.settingRow}>
        <label class={styles.label}>Default Model</label>
        <ModelSelector
          model={settingsStore.model}
          setModel={settingsStore.setModel}
          availableModels={modelsStore.availableModels}
          isLoadingModels={modelsStore.isLoadingModels}
          onRefreshModels={() => modelsStore.fetchModels()}
        />
      </div>

      <CategoryModelOverrides />
    </div>
  )

  const renderSectionContent = (sectionId: string) => {
    switch (sectionId) {
      case 'api-keys':
        return <ApiKeys />
      case 'models':
        return renderModelsSection()
      case 'custom-providers':
        return <CustomProviders />
      default:
        return null
    }
  }

  return (
    <ListDetailPanel
      ref={(r) => (panelRef = r)}
      items={AI_SETTINGS_SECTIONS}
      emptyStateMessage="Select a section"
      renderListItem={(section) => (
        <div class={styles.listItem}>
          {section.icon}
          <span>{section.name}</span>
        </div>
      )}
      detailTitle={(section) => section.name}
      renderDetail={(section) => renderSectionContent(section.id)}
    />
  )
}

interface AISettingsPanelProps {
  show: boolean
  onClose: () => void
}

export const AISettingsPanel: Component<AISettingsPanelProps> = (props) => {
  return (
    <OverlayPanel show={props.show} onClose={props.onClose} title="AI Settings">
      <AISettingsContent />
    </OverlayPanel>
  )
}
