import { Component, Show, createEffect, createSignal } from "solid-js";
import styles from "./CopyTokenModal.module.css";
import { copyPreviewStore } from "../stores/copyPreviewStore";

export const CopyTokenModal: Component = () => {
  const state = copyPreviewStore.state;
  let textareaRef: HTMLTextAreaElement | undefined;
  const [copiedMessage, setCopiedMessage] = createSignal(false);

  createEffect(() => {
    if (state.showFallback && textareaRef) {
      textareaRef.select();
    }
  });

  const handleCopyFallback = () => {
    if (textareaRef) {
      textareaRef.select();
      try {
        document.execCommand("copy");
        setCopiedMessage(true);
        setTimeout(() => setCopiedMessage(false), 2000);
      } catch {
        alert("Failed to copy. Please select and copy manually.");
      }
    }
  };

  return (
    <Show when={state.isOpen}>
      <div class={styles.overlay}>
        <div class={styles.modal}>
          <h2 class={styles.title}>
            <Show when={state.showFallback} fallback="Token Count Preview">
              Copy Text
            </Show>
          </h2>
          <div class={styles.body}>
            <Show when={state.showFallback}>
              <p>Copy the text below manually:</p>
              <textarea
                ref={textareaRef}
                class={styles.fallbackTextarea}
                value={state.text}
                readonly
              />
              <Show when={copiedMessage()}>
                <p class={styles.copiedMessage}>Copied to clipboard!</p>
              </Show>
            </Show>
            <Show when={!state.showFallback}>
              <Show when={state.isLoading}>
                <p>Calculating token usage…</p>
              </Show>
              <Show when={!state.isLoading && !state.error && state.tokens !== null}>
                <p>
                  Copied text constitutes{" "}
                  <span class={styles.tokenValue}>
                    {state.tokens!.toLocaleString()}
                  </span>{" "}
                  tokens.
                </p>
              </Show>
              <Show when={state.error}>
                <p class={styles.error}>{state.error}</p>
              </Show>
            </Show>
          </div>
          <div class={styles.actions}>
            <button
              class={styles.secondary}
              type="button"
              onClick={() => copyPreviewStore.cancel()}
              disabled={state.isLoading}
            >
              <Show when={state.showFallback} fallback="Cancel">
                Done
              </Show>
            </button>
            <Show when={!state.showFallback}>
              <button
                class={styles.primary}
                type="button"
                onClick={() => copyPreviewStore.confirmCopy()}
                disabled={state.isLoading}
              >
                Copy
              </button>
            </Show>
            <Show when={state.showFallback}>
              <button
                class={styles.primary}
                type="button"
                onClick={handleCopyFallback}
              >
                {copiedMessage() ? "Copied!" : "Copy"}
              </button>
            </Show>
          </div>
        </div>
      </div>
    </Show>
  );
};
