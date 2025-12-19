import { generate } from 'short-uuid'
import { createStore } from 'solid-js/store'
export interface Notification {
  id: string
  title: string
  message: string
  pre?: boolean
  type: 'info' | 'success' | 'warning' | 'error'
  details?: Record<string, string[]>
}

interface NotificationsState {
  notifications: Notification[]
}

const initialState: NotificationsState = {
  notifications: [],
}

export const [notificationsState, setNotificationsState] = createStore(initialState)

export function addNotification(notification: Omit<Notification, 'id'>) {
  const id = generate()
  setNotificationsState('notifications', (notifications) => [...notifications, { ...notification, id }])
  setTimeout(() => {
    removeNotification(id)
  }, 5000)
}

export function removeNotification(id: string) {
  setNotificationsState('notifications', (notifications) =>
    notifications.filter((notification) => notification.id !== id),
  )
}
