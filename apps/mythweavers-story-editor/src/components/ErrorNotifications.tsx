import { Toast, ToastContainer } from '@mythweavers/ui'
import { Component, For } from 'solid-js'
import { errorStore } from '../stores/errorStore'

export const ErrorNotifications: Component = () => {
  return (
    <ToastContainer position="top-right">
      <For each={errorStore.errors}>
        {(error) => (
          <Toast
            variant={error.type}
            message={error.message}
            onClose={() => errorStore.removeError(error.id)}
            duration={error.type === 'warning' ? 15000 : 0}
          />
        )}
      </For>
    </ToastContainer>
  )
}
