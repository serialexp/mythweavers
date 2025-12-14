import { Component, createSignal, onMount, Show, For } from 'solid-js';
import { getMyMessagesByMessageIdRevisions } from '../client/config';
import styles from './MessageVersionHistory.module.css';
import { BsClockHistory, BsPencil, BsArrowRepeat } from 'solid-icons/bs';

interface MessageVersionHistoryProps {
  messageId: string;
  onClose: () => void;
}

interface MessageVersion {
  id: string;
  versionType: 'initial' | 'regeneration' | 'edit' | 'rewrite' | 'cli_edit';
  content?: string;
  instruction?: string | null;
  model: string | null;
  version: number;
  createdAt: string;
  // AI metadata fields
  think?: string | null;
  totalTokens?: number | null;
}

interface VersionData {
  revisions: MessageVersion[];
}

export const MessageVersionHistory: Component<MessageVersionHistoryProps> = (props) => {
  const [loading, setLoading] = createSignal(true);
  const [versionData, setVersionData] = createSignal<VersionData | null>(null);
  const [selectedVersion, setSelectedVersion] = createSignal<MessageVersion | null>(null);
  const [showDiff, setShowDiff] = createSignal(false);

  onMount(async () => {
    await loadVersions();
  });

  const loadVersions = async () => {
    try {
      setLoading(true);

      console.log('[MessageVersionHistory] Loading revisions for message:', props.messageId);
      const response = await getMyMessagesByMessageIdRevisions({
        path: { messageId: props.messageId }
      });

      console.log('[MessageVersionHistory] Response:', response);

      if (!response.data) {
        throw new Error('No data returned from API');
      }

      console.log('[MessageVersionHistory] Response data:', response.data);

      setVersionData(response.data);

      // Select the most recent version by default if any exist
      if (response.data.revisions && response.data.revisions.length > 0) {
        setSelectedVersion(response.data.revisions[0]);
      }
    } catch (error) {
      console.error('Failed to load message versions:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getVersionIcon = (type: string) => {
    switch (type) {
      case 'initial':
        return <BsClockHistory />;
      case 'edit':
      case 'cli_edit':
      case 'rewrite':
        return <BsPencil />;
      case 'regeneration':
      default:
        return <BsArrowRepeat />;
    }
  };

  const getVersionTypeLabel = (type: string) => {
    switch (type) {
      case 'initial':
        return 'Initial';
      case 'edit':
        return 'Manual Edit';
      case 'cli_edit':
        return 'CLI Edit';
      case 'rewrite':
        return 'Bulk Rewrite';
      case 'regeneration':
        return 'Regeneration';
      default:
        return type; // Show the raw type if unknown
    }
  };

  return (
    <div class={styles.modal}>
      <div class={styles.modalContent}>
        <div class={styles.header}>
          <h3>
            <BsClockHistory />
            <span>Version History</span>
          </h3>
          <button class={styles.closeButton} onClick={props.onClose}>
            ×
          </button>
        </div>

        <Show when={loading()}>
          <div class={styles.loading}>Loading version history...</div>
        </Show>

        <Show when={!loading() && versionData()}>
          <div class={styles.body}>
            <div class={styles.versionList}>
              <div class={styles.versionListHeader}>
                <h4>Revisions</h4>
                <span class={styles.versionCount}>
                  {versionData()!.revisions.length} revision{versionData()!.revisions.length !== 1 ? 's' : ''}
                </span>
              </div>

              <Show when={versionData()!.revisions.length === 0}>
                <div class={styles.noVersions}>
                  No revisions available. Revisions are created when you regenerate or edit messages.
                </div>
              </Show>

              <For each={versionData()!.revisions}>
                {(version) => (
                  <div
                    class={styles.versionItem}
                    classList={{ [styles.selected]: selectedVersion()?.id === version.id }}
                    onClick={() => setSelectedVersion(version)}
                  >
                    <div class={styles.versionHeader}>
                      <div class={styles.versionInfo}>
                        <span class={styles.versionIcon}>
                          {getVersionIcon(version.versionType)}
                        </span>
                        <span class={styles.versionNumber}>v{version.version}</span>
                        <span class={styles.versionType}>
                          {getVersionTypeLabel(version.versionType)}
                        </span>
                      </div>
                    </div>
                    <div class={styles.versionModel}>{formatDate(version.createdAt)}</div>
                  </div>
                )}
              </For>
            </div>

            <div class={styles.versionContent}>
              <div class={styles.contentHeader}>
                <h4>
                  {selectedVersion() ? `Version ${selectedVersion()!.version}` : 'Current Version'}
                </h4>
                <Show when={versionData()!.revisions.length > 0}>
                  <button
                    class={styles.toggleButton}
                    onClick={() => setShowDiff(!showDiff())}
                  >
                    {showDiff() ? 'Show Full Content' : 'Show Differences'}
                  </button>
                </Show>
              </div>

              <div class={styles.contentBody}>
                <Show when={selectedVersion()}>
                  <Show when={selectedVersion()!.instruction}>
                    <div class={styles.instruction}>
                      <strong>Instruction:</strong> {selectedVersion()!.instruction}
                    </div>
                  </Show>
                  <div class={styles.content}>
                    {selectedVersion()!.content}
                  </div>
                </Show>

                <Show when={!selectedVersion() && versionData()}>
                  <div class={styles.currentVersionNote}>
                    This is the current version of the message. Select a version from the list to view it.
                  </div>
                  <Show when={versionData()!.current.instruction}>
                    <div class={styles.instruction}>
                      <strong>Instruction:</strong> {versionData()!.current.instruction}
                    </div>
                  </Show>
                  <div class={styles.content}>
                    {versionData()!.current.content}
                  </div>
                </Show>
              </div>
            </div>
          </div>
        </Show>
      </div>
    </div>
  );
};
