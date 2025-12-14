import { createSignal, Show } from 'solid-js';
import { apiClient } from '../utils/apiClient';
import styles from './ForgotPassword.module.css';

interface ForgotPasswordProps {
  onClose: () => void;
  onBackToLogin: () => void;
}

export function ForgotPassword(props: ForgotPasswordProps) {
  const [email, setEmail] = createSignal('');
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal('');
  const [success, setSuccess] = createSignal(false);

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const result = await apiClient.requestPasswordReset(email());

      if (!result.success) {
        throw new Error(result.error || 'Failed to request password reset');
      }

      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div class={styles.overlay}>
      <div class={styles.container}>
        <button class={styles.closeButton} onClick={props.onClose}>×</button>
        
        <Show when={!success()} fallback={
          <div class={styles.successMessage}>
            <h2>Check Your Email</h2>
            <p>If an account exists with the email address you provided, we've sent password reset instructions to that email.</p>
            <p>Please check your inbox and follow the link to reset your password.</p>
            <button 
              class={styles.button}
              onClick={props.onBackToLogin}
            >
              Back to Login
            </button>
          </div>
        }>
          <form onSubmit={handleSubmit} class={styles.form}>
            <h2>Forgot Password</h2>
            <p class={styles.description}>
              Enter your email address and we'll send you a link to reset your password.
            </p>
            
            <Show when={error()}>
              <div class={styles.error}>{error()}</div>
            </Show>

            <div class={styles.field}>
              <label for="email">Email</label>
              <input
                type="email"
                id="email"
                value={email()}
                onInput={(e) => setEmail(e.currentTarget.value)}
                required
                disabled={loading()}
                placeholder="Enter your email"
              />
            </div>

            <button 
              type="submit" 
              class={styles.submitButton}
              disabled={loading() || !email()}
            >
              {loading() ? 'Sending...' : 'Send Reset Link'}
            </button>

            <button 
              type="button"
              class={styles.linkButton}
              onClick={props.onBackToLogin}
            >
              Back to Login
            </button>
          </form>
        </Show>
      </div>
    </div>
  );
}