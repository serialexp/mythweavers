import { For, Show, createMemo, createSignal } from "solid-js";
import { Message as MessageType } from "../types/core";
import { NodeHeader } from "./NodeHeader";
import { InsertControls } from "./InsertControls";
import { nodeStore } from "../stores/nodeStore";
import { BsCodeSlash, BsExclamationTriangle, BsPencil } from "solid-icons/bs";
import { createDisplayMessagesMemo } from "../utils/messageFiltering";
import { ScriptDataDiff } from "./ScriptDataDiff";
import { scriptDataStore } from "../stores/scriptDataStore";
import { MessageScriptModal } from "./MessageScriptModal";
import styles from "./ScriptModeView.module.css";
import messageListStyles from "./MessageList.module.css";

interface ScriptModeViewProps {
    isGenerating: boolean;
}

export function ScriptModeView(_props: ScriptModeViewProps) {
    // Get the filtered messages to display
    const displayMessages = createDisplayMessagesMemo();

    // State for script modal
    const [editingMessage, setEditingMessage] = createSignal<MessageType | null>(null);

    // Get the currently selected node
    const selectedNode = createMemo(() => {
        const node = nodeStore.getSelectedNode();
        if (node && node.type === 'scene') {
            return node;
        }
        return null;
    });

    // Filter messages that have scripts
    const scriptMessages = createMemo(() => {
        return displayMessages().filter(msg => msg.script && msg.script.trim() !== '');
    });

    const hasSceneNode = createMemo(() => nodeStore.nodesArray.some(n => n.type === 'scene'));
    const isSceneSelected = createMemo(() => selectedNode() !== null);

    return (
        <>
            {/* Show the node header at the top if a node is selected */}
            <Show when={selectedNode()}>
                {(node) => (
                    <NodeHeader
                        node={node()}
                        messageCount={scriptMessages().length}
                    />
                )}
            </Show>

            {/* Show warning if no scene is selected but scenes exist */}
            <Show when={!isSceneSelected() && hasSceneNode()}>
                <div class={messageListStyles.noChapterWarning}>
                    <BsExclamationTriangle />
                    <div>
                        <h3>No Scene Selected</h3>
                        <p>Please select a scene from the navigation panel to view script content.</p>
                    </div>
                </div>
            </Show>

            {/* Show special message when no scripts exist */}
            <Show when={scriptMessages().length === 0 && isSceneSelected()}>
                <div class={messageListStyles.noScriptsMessage}>
                    <BsCodeSlash />
                    <div>
                        <h3>No Messages with Scripts</h3>
                        <p>There are no messages with scripts in this chapter.</p>
                    </div>
                </div>
            </Show>

            {/* Insert controls at the beginning if there are script messages */}
            <Show when={scriptMessages().length > 0 && selectedNode()}>
                <InsertControls
                    afterMessageId={null}
                    nodeId={selectedNode()?.id}
                />
            </Show>

            {/* Display script messages */}
            <For each={scriptMessages()}>
                {(message) => (
                    <>
                    <div class={styles.scriptMessage}>
                        {/* Header with summary and edit button */}
                        <div class={styles.messageHeader}>
                            <div class={styles.messageSummary}>
                                {message.summary || message.paragraphSummary ||
                                 message.content.slice(0, 200) + (message.content.length > 200 ? '...' : '')}
                            </div>
                            <button
                                class={styles.editButton}
                                onClick={() => setEditingMessage(message)}
                                title="Edit script"
                            >
                                <BsPencil /> Edit Script
                            </button>
                        </div>

                        {/* Show script code */}
                        <Show when={message.script}>
                            <div class={styles.scriptSection}>
                                <div class={styles.scriptHeader}>Script Code:</div>
                                <pre class={styles.scriptCode}>
                                    <code>
                                        {message.script!
                                            .split('\n')
                                            .filter(line => {
                                                const trimmedLine = line.trim();
                                                // Filter out comment lines and empty lines
                                                return trimmedLine && !trimmedLine.startsWith('//');
                                            })
                                            .join('\n')}
                                    </code>
                                </pre>
                            </div>
                        </Show>

                        {/* Show script data changes */}
                        <Show when={scriptDataStore.getDataStateForMessage(message.id)}>
                            {(dataState) => (
                                <div class={styles.dataChangesSection}>
                                    <ScriptDataDiff
                                        before={dataState().before}
                                        after={dataState().after}
                                        messageId={message.id}
                                    />
                                </div>
                            )}
                        </Show>
                    </div>
                    <InsertControls
                        afterMessageId={message.id}
                        nodeId={message.nodeId || selectedNode()?.id}
                    />
                    </>
                )}
            </For>

            {/* Script Edit Modal */}
            <Show when={editingMessage()}>
                {(message) => (
                    <MessageScriptModal
                        message={message()}
                        onClose={() => setEditingMessage(null)}
                    />
                )}
            </Show>
        </>
    );
}