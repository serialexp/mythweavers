import { Component, Show } from 'solid-js';
import { Message as MessageType } from '../types/core';
import { InsertMessageButton } from './InsertMessageButton';
import { InsertEventButton } from './InsertEventButton';
import { InsertBranchButton } from './InsertBranchButton';
import { generateMessageId } from '../utils/id';
import { messagesStore } from '../stores/messagesStore';
import { uiStore } from '../stores/uiStore';
import { BsArrowDownCircle } from 'solid-icons/bs';
import styles from './MessageListItems.module.css';

interface InsertControlsProps {
    afterMessageId?: string | null;  // null means insert at beginning
    nodeId?: string;  // The node/chapter to insert into
}

export const InsertControls: Component<InsertControlsProps> = (props) => {
    const handleInsertMessage = () => {
        const newMessage: MessageType = {
            id: generateMessageId(),
            role: "assistant",
            content: "",
            instruction: "test",
            timestamp: new Date(),
            order: 0,  // Will be set properly when saved
            isQuery: false,
            sceneId: props.nodeId,  // Messages belong to scenes
        };

        if (props.afterMessageId === null) {
            // Insert at the beginning of the chapter
            messagesStore.insertMessage(null, newMessage);
        } else if (props.afterMessageId) {
            // Insert after the specified message
            messagesStore.insertMessage(props.afterMessageId, newMessage);
        } else {
            // This is at the end - find the last message
            const messages = messagesStore.messages.filter(m =>
                m.nodeId === props.nodeId || m.chapterId === props.nodeId
            );
            const lastMessage = messages[messages.length - 1];
            if (lastMessage) {
                messagesStore.insertMessage(lastMessage.id, newMessage);
            } else {
                // No messages in chapter, insert at beginning
                messagesStore.insertMessage(null, newMessage);
            }
        }
    };

    const handlePaste = async () => {
        if (!props.nodeId) return;

        const cutMessageIds = Array.from(uiStore.cutMessageIds);
        if (cutMessageIds.length === 0) return;

        const messages = messagesStore.messages;
        const sortedCutMessageIds = cutMessageIds.sort((a, b) => {
            const indexA = messages.findIndex(m => m.id === a);
            const indexB = messages.findIndex(m => m.id === b);
            return indexA - indexB;
        });

        const nodeMessages = messages
            .filter(m => m.nodeId === props.nodeId || m.chapterId === props.nodeId)
            .sort((a, b) => a.order - b.order);

        let insertAfter: string | null;
        if (props.afterMessageId === null) {
            insertAfter = null;
        } else if (typeof props.afterMessageId === 'string') {
            insertAfter = props.afterMessageId;
        } else {
            const lastMessage = nodeMessages[nodeMessages.length - 1];
            insertAfter = lastMessage ? lastMessage.id : null;
        }

        for (const messageId of sortedCutMessageIds) {
            await messagesStore.moveMessage(messageId, insertAfter, props.nodeId);
            insertAfter = messageId;
        }

        uiStore.clearCut();
    };

    return (
        <div class={styles.insertButtonsContainer}>
            <InsertMessageButton onInsert={handleInsertMessage} />
            <InsertEventButton
                afterMessageId={props.afterMessageId}
            />
            <InsertBranchButton
                afterMessageId={props.afterMessageId}
                nodeId={props.nodeId}
            />
            <Show when={uiStore.hasCutMessage()}>
                <button
                    class={styles.pasteButton}
                    onClick={handlePaste}
                    title={(() => {
                        const count = uiStore.getCutMessageCount();
                        const label = count > 1 ? `${count} cut messages` : 'cut message';
                        if (props.afterMessageId === null) {
                            return `Paste ${label} at beginning`;
                        }
                        return `Paste ${label} here`;
                    })()}
                >
                    <BsArrowDownCircle size={18} /> Paste{uiStore.getCutMessageCount() > 1 ? ` ${uiStore.getCutMessageCount()} Messages` : ' Message'}
                </button>
            </Show>
        </div>
    );
};
