import { createStore } from 'solid-js/store';
import { generateMessageId } from '../utils/id';

export interface ErrorNotification {
  id: string;
  message: string;
  timestamp: Date;
  type: 'error' | 'warning';
}

interface ErrorState {
  errors: ErrorNotification[];
}

const [state, setState] = createStore<ErrorState>({
  errors: []
});

export const errorStore = {
  get errors() {
    return state.errors;
  },

  addError(message: string, type: 'error' | 'warning' = 'error') {
    const error: ErrorNotification = {
      id: generateMessageId(),
      message,
      timestamp: new Date(),
      type
    };
    
    setState('errors', errors => [...errors, error]);
    
    // Only auto-remove warnings after 15 seconds
    // Errors must be manually dismissed
    if (type === 'warning') {
      setTimeout(() => {
        this.removeError(error.id);
      }, 15000);
    }
    
    return error.id;
  },

  removeError(id: string) {
    setState('errors', errors => errors.filter(e => e.id !== id));
  },

  clearAll() {
    setState('errors', []);
  }
};