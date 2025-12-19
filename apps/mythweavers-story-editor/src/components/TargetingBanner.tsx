import { Alert, Button } from '@mythweavers/ui'
import { BsX } from 'solid-icons/bs'
import { Component } from 'solid-js'
import { uiStore } from '../stores/uiStore'

export const TargetingBanner: Component = () => {
  const handleCancel = () => {
    uiStore.cancelTargeting()
  }

  return (
    <div
      style={{
        position: 'sticky',
        top: '0',
        'z-index': '100',
        animation: 'slideDown 0.3s ease-out',
      }}
    >
      <Alert variant="info" title="Targeting Mode Active" icon={<span style={{ 'font-size': '1.5rem' }}>🎯</span>}>
        <div style={{ display: 'flex', 'align-items': 'center', 'justify-content': 'space-between', gap: '1rem' }}>
          <span>Click "Set as Target" on any message to set it as the branch target</span>
          <Button variant="danger" size="sm" onClick={handleCancel}>
            <BsX size={18} /> Cancel
          </Button>
        </div>
      </Alert>
    </div>
  )
}
