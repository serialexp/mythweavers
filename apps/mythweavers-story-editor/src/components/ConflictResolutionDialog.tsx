import { Button, Card, CardBody, Modal, Stack } from '@mythweavers/ui'
import { Component } from 'solid-js'
import * as styles from './ConflictResolutionDialog.css'

interface ConflictResolutionDialogProps {
  isOpen: boolean
  serverUpdatedAt: string
  clientUpdatedAt: string
  onForce: () => void
  onCancel: () => void
}

export const ConflictResolutionDialog: Component<ConflictResolutionDialogProps> = (props) => {
  const formatDate = (dateString: string) => {
    if (!dateString) return 'Unknown'
    const date = new Date(dateString)
    if (Number.isNaN(date.getTime())) return 'Invalid Date'
    return date.toLocaleString()
  }

  return (
    <Modal
      open={props.isOpen}
      onClose={props.onCancel}
      title="Version Conflict Detected"
      size="md"
      footer={
        <Stack direction="horizontal" gap="sm" justify="end">
          <Button variant="secondary" onClick={props.onCancel}>
            Cancel
          </Button>
          <Button onClick={props.onForce}>Force Save</Button>
        </Stack>
      }
    >
      <Stack direction="vertical" gap="md">
        <p class={styles.description}>
          The story on the server has been updated more recently than your local version.
        </p>

        <Card variant="flat">
          <CardBody padding="sm" gap="sm">
            <Stack direction="horizontal" justify="between">
              <span class={styles.versionLabel}>Server version:</span>
              <span class={styles.versionValue}>{formatDate(props.serverUpdatedAt)}</span>
            </Stack>
            <Stack direction="horizontal" justify="between">
              <span class={styles.versionLabel}>Your version:</span>
              <span class={styles.versionValue}>{formatDate(props.clientUpdatedAt)}</span>
            </Stack>
          </CardBody>
        </Card>

        <p class={styles.warningText}>Do you want to overwrite the server version with your changes?</p>
      </Stack>
    </Modal>
  )
}
