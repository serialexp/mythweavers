import { Component, For } from 'solid-js';
import { errorStore } from '../stores/errorStore';
import { BsXLg, BsExclamationTriangle, BsExclamationOctagon } from 'solid-icons/bs';
import styles from './ErrorNotifications.module.css';

export const ErrorNotifications: Component = () => {
  return (
    <div class={styles.container}>
      <For each={errorStore.errors}>
        {(error) => (
          <div 
            class={`${styles.notification} ${error.type === 'warning' ? styles.warning : styles.error}`}
            role="alert"
          >
            <div class={styles.icon}>
              {error.type === 'warning' ? (
                <BsExclamationTriangle />
              ) : (
                <BsExclamationOctagon />
              )}
            </div>
            <div class={styles.message}>
              {error.message}
            </div>
            <button
              class={styles.closeButton}
              onClick={() => errorStore.removeError(error.id)}
              aria-label="Dismiss"
            >
              <BsXLg />
            </button>
          </div>
        )}
      </For>
    </div>
  );
};