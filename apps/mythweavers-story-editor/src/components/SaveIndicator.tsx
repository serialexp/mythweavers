import { Component, Show } from "solid-js";
import { BsCloudCheck, BsHddFill, BsArrowRepeat, BsExclamationTriangle } from "solid-icons/bs";
import { messagesStore } from "../stores/messagesStore";
import { currentStoryStore } from "../stores/currentStoryStore";
import styles from "./HeaderButton.module.css";

export const SaveIndicator: Component = () => {
    return (
        <Show
            when={!messagesStore.lastSaveError}
            fallback={
                <div
                    class={`${styles.headerButton} ${styles.danger}`}
                    title={messagesStore.lastSaveError || 'Save error'}
                    style={{ cursor: "help" }}
                >
                    <BsExclamationTriangle />
                </div>
            }
        >
            <Show
                when={!messagesStore.isSaving}
                fallback={
                    <div
                        class={styles.headerButton}
                        title="Saving..."
                        style={{ cursor: "help" }}
                    >
                        <BsArrowRepeat style={{ animation: "spin 1s linear infinite" }} />
                    </div>
                }
            >
                <div
                    class={styles.headerButton}
                    title={`${currentStoryStore.storageMode === 'server' ? 'Cloud' : 'Local'} - Last saved: ${currentStoryStore.lastAutoSaveAt?.toLocaleTimeString() || 'Never'}`}
                    style={{ cursor: "help" }}
                >
                    {currentStoryStore.storageMode === 'server' ? (
                        <BsCloudCheck style={{ color: "var(--success-color)" }} />
                    ) : (
                        <BsHddFill style={{ color: "var(--success-color)" }} />
                    )}
                </div>
            </Show>
        </Show>
    );
};