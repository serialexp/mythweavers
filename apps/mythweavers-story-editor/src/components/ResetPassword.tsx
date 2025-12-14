import { createSignal, onMount, Show } from 'solid-js';
import { useSearchParams } from '@solidjs/router';
import { apiClient } from '../utils/apiClient';
import styles from './ResetPassword.module.css';

interface ResetPasswordProps {
  onClose: () => void;
  onSuccess: () => void;
}

export function ResetPassword(props: ResetPasswordProps) {
  const [searchParams] = useSearchParams();
  const [newPassword, setNewPassword] = createSignal('');
  const [confirmPassword, setConfirmPassword] = createSignal('');
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal('');
  const [validating, setValidating] = createSignal(true);
  const [tokenValid, setTokenValid] = createSignal(false);
  const [userInfo, setUserInfo] = createSignal<{ email: string; username: string } | null>(null);
  const [success, setSuccess] = createSignal(false);

  onMount(async () => {
    const token = Array.isArray(searchParams.token) ? searchParams.token[0] : searchParams.token;
    if (!token) {
      setError('No reset token provided');
      setValidating(false);
      return;
    }

    try {
      const result = await apiClient.validateResetToken(token);

      if (!result.valid) {
        throw new Error(result.error || 'Invalid token');
      }

      setTokenValid(true);
      setUserInfo({ email: result.email!, username: result.username! });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid or expired token');
    } finally {
      setValidating(false);
    }
  });

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    setError('');

    if (newPassword() !== confirmPassword()) {
      setError('Passwords do not match');
      return;
    }

    if (newPassword().length < 8) {
      setError('Password must be at least 8 characters long');
      return;
    }

    setLoading(true);

    try {
      const token = Array.isArray(searchParams.token) ? searchParams.token[0] : searchParams.token;
      if (!token) {
        throw new Error('No reset token provided');
      }

      const result = await apiClient.resetPassword(token, newPassword());

      if (!result.success) {
        throw new Error(result.error || 'Failed to reset password');
      }

      setSuccess(true);
      // Wait a bit to show success message before redirecting
      setTimeout(() => {
        props.onSuccess();
      }, 2000);
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
        
        <Show when={validating()}>
          <div class={styles.loading}>Validating reset token...</div>
        </Show>

        <Show when={!validating() && !tokenValid()}>
          <div class={styles.errorContainer}>
            <h2>Invalid Reset Link</h2>
            <p>{error()}</p>
            <button class={styles.button} onClick={props.onClose}>
              Back to Login
            </button>
          </div>
        </Show>

        <Show when={!validating() && tokenValid() && !success()}>
          <form onSubmit={handleSubmit} class={styles.form}>
            <h2>Reset Password</h2>
            
            <Show when={userInfo()}>
              <p class={styles.userInfo}>
                Resetting password for: <strong>{userInfo()!.username}</strong>
              </p>
            </Show>
            
            <Show when={error()}>
              <div class={styles.error}>{error()}</div>
            </Show>

            <div class={styles.field}>
              <label for="newPassword">New Password</label>
              <input
                type="password"
                id="newPassword"
                value={newPassword()}
                onInput={(e) => setNewPassword(e.currentTarget.value)}
                required
                disabled={loading()}
                placeholder="Enter new password (min. 8 characters)"
                minLength={8}
              />
            </div>

            <div class={styles.field}>
              <label for="confirmPassword">Confirm Password</label>
              <input
                type="password"
                id="confirmPassword"
                value={confirmPassword()}
                onInput={(e) => setConfirmPassword(e.currentTarget.value)}
                required
                disabled={loading()}
                placeholder="Confirm new password"
              />
            </div>

            <button 
              type="submit" 
              class={styles.submitButton}
              disabled={loading() || !newPassword() || !confirmPassword()}
            >
              {loading() ? 'Resetting...' : 'Reset Password'}
            </button>
          </form>
        </Show>

        <Show when={success()}>
          <div class={styles.successContainer}>
            <h2>Password Reset Successful!</h2>
            <p>Your password has been reset successfully.</p>
            <p>Redirecting to login page...</p>
          </div>
        </Show>
      </div>
    </div>
  );
}