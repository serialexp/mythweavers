import { Badge, Button, Card, CardBody, Modal, Spinner, Stack } from '@mythweavers/ui'
import { BsArrowClockwise, BsBook, BsFolder2, BsFileText, BsLayers, BsTrash } from 'solid-icons/bs'
import { Component, For, Show, createResource, createSignal } from 'solid-js'
import {
  getMyStoriesByIdDeletedNodes,
  postMyStoriesByIdDeletedBooksByBookIdRestore,
  postMyStoriesByIdDeletedArcsByArcIdRestore,
  postMyStoriesByIdDeletedChaptersByChapterIdRestore,
  postMyStoriesByIdDeletedScenesBySceneIdRestore,
} from '../client/config'
import { currentStoryStore } from '../stores/currentStoryStore'
import * as styles from './DeletedNodesModal.css'

interface DeletedNodesModalProps {
  show: boolean
  onClose: () => void
  onRestore?: () => void
}

type DeletedNode = {
  id: string
  name: string
  type: 'book' | 'arc' | 'chapter' | 'scene'
  parentName: string | null
  deletedAt: string | null
}

const nodeTypeLabels: Record<DeletedNode['type'], string> = {
  book: 'Book',
  arc: 'Arc',
  chapter: 'Chapter',
  scene: 'Scene',
}

const nodeTypeIcons: Record<DeletedNode['type'], typeof BsBook> = {
  book: BsBook,
  arc: BsFolder2,
  chapter: BsFileText,
  scene: BsLayers,
}

const nodeTypeVariants: Record<DeletedNode['type'], 'primary' | 'secondary' | 'default'> = {
  book: 'primary',
  arc: 'secondary',
  chapter: 'default',
  scene: 'default',
}

export const DeletedNodesModal: Component<DeletedNodesModalProps> = (props) => {
  const [restoringId, setRestoringId] = createSignal<string | null>(null)

  const [deletedNodes, { refetch }] = createResource(
    () => props.show && currentStoryStore.id,
    async (storyId) => {
      if (!storyId) return []
      const { data } = await getMyStoriesByIdDeletedNodes({ path: { id: storyId } })
      return (data?.nodes ?? []) as DeletedNode[]
    },
  )

  const handleRestore = async (node: DeletedNode) => {
    const storyId = currentStoryStore.id
    if (!storyId) return

    setRestoringId(node.id)
    try {
      switch (node.type) {
        case 'book':
          await postMyStoriesByIdDeletedBooksByBookIdRestore({ path: { id: storyId, bookId: node.id } })
          break
        case 'arc':
          await postMyStoriesByIdDeletedArcsByArcIdRestore({ path: { id: storyId, arcId: node.id } })
          break
        case 'chapter':
          await postMyStoriesByIdDeletedChaptersByChapterIdRestore({ path: { id: storyId, chapterId: node.id } })
          break
        case 'scene':
          await postMyStoriesByIdDeletedScenesBySceneIdRestore({ path: { id: storyId, sceneId: node.id } })
          break
      }
      refetch()
      props.onRestore?.()
    } catch (error) {
      console.error('Failed to restore node:', error)
      alert('Failed to restore node')
    } finally {
      setRestoringId(null)
    }
  }

  const formatDate = (timestamp: string | null) => {
    if (!timestamp) return 'Unknown'
    const date = new Date(timestamp)
    return date.toLocaleString()
  }

  return (
    <Modal
      open={props.show}
      onClose={props.onClose}
      title={
        <span style={{ display: 'flex', 'align-items': 'center', gap: '0.5rem' }}>
          <BsTrash /> Deleted Story Nodes
        </span>
      }
      size="lg"
    >
      <div style={{ flex: 1, 'overflow-y': 'auto', padding: '1.5rem', 'max-height': 'calc(80vh - 120px)' }}>
        <Show
          when={!deletedNodes.loading}
          fallback={
            <div class={styles.loadingContainer}>
              <Spinner size="md" />
              <div class={styles.loadingText}>Loading deleted nodes...</div>
            </div>
          }
        >
          <Show
            when={deletedNodes() && deletedNodes()!.length > 0}
            fallback={<div class={styles.emptyMessage}>No deleted story nodes found</div>}
          >
            <Stack gap="md">
              <For each={deletedNodes()}>
                {(node) => {
                  const Icon = nodeTypeIcons[node.type]
                  return (
                    <Card interactive>
                      <CardBody>
                        <div class={styles.nodeHeader}>
                          <div class={styles.nodeMetaContainer}>
                            <Badge variant={nodeTypeVariants[node.type]}>
                              <span class={styles.nodeTypeIcon}>
                                <Icon />
                                {nodeTypeLabels[node.type]}
                              </span>
                            </Badge>
                            <span style={{ 'font-weight': 500 }}>{node.name || '(Unnamed)'}</span>
                            <Show when={node.parentName}>
                              <span class={styles.nodeMeta}>in {node.parentName}</span>
                            </Show>
                            <span class={styles.nodeMeta}>{formatDate(node.deletedAt)}</span>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRestore(node)}
                            disabled={restoringId() === node.id}
                            title="Restore this node and all its contents"
                          >
                            <BsArrowClockwise />
                            {restoringId() === node.id ? 'Restoring...' : 'Restore'}
                          </Button>
                        </div>
                      </CardBody>
                    </Card>
                  )
                }}
              </For>
            </Stack>
          </Show>
        </Show>
      </div>
    </Modal>
  )
}
