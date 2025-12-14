import { createSignal, Component, Show } from 'solid-js';
import { postAuthRegister, postAuthLogin } from '../client/config';
import { ForgotPassword } from './ForgotPassword';
import styles from './LoginForm.module.css';

interface LoginFormProps {
  onSuccess: (user: any | { offline: boolean }) => void;
}

export const LoginForm: Component<LoginFormProps> = (props) => {
  const [isRegistering, setIsRegistering] = createSignal(false);
  const [showForgotPassword, setShowForgotPassword] = createSignal(false);
  const [email, setEmail] = createSignal('');
  const [username, setUsername] = createSignal('');
  const [password, setPassword] = createSignal('');
  const [confirmPassword, setConfirmPassword] = createSignal('');
  const [error, setError] = createSignal('');
  const [isLoading, setIsLoading] = createSignal(false);

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      if (isRegistering()) {
        // Validate registration
        if (!email() || !username() || !password()) {
          setError('All fields are required');
          setIsLoading(false);
          return;
        }

        if (password().length < 8) {
          setError('Password must be at least 8 characters');
          setIsLoading(false);
          return;
        }

        if (password() !== confirmPassword()) {
          setError('Passwords do not match');
          setIsLoading(false);
          return;
        }

        const result = await postAuthRegister({
          body: {
            email: email(),
            username: username(),
            password: password()
          }
        });

        if (result.data) {
          props.onSuccess(result.data.user);
        } else if (result.error) {
          setError(result.error.error || 'Registration failed');
        } else {
          setError('Registration failed');
        }
      } else {
        // Login
        if (!username() || !password()) {
          setError('Username and password are required');
          setIsLoading(false);
          return;
        }

        console.log('[LoginForm] Attempting login...');
        const result = await postAuthLogin({
          body: {
            username: username(),
            password: password()
          }
        });
        console.log('[LoginForm] Login result:', result);
        if (result.data) {
          console.log('[LoginForm] Login successful, calling onSuccess with user:', result.data.user);
          props.onSuccess(result.data.user);
          console.log('[LoginForm] onSuccess called');
        } else if (result.error) {
          console.log('[LoginForm] Login failed:', result.error);
          setError(result.error.error || 'Login failed');
        } else {
          setError('Login failed');
        }
      }
    } catch (err) {
      console.error('Auth error:', err);
      setError('An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const switchMode = () => {
    setIsRegistering(!isRegistering());
    setError('');
    setEmail('');
    setUsername('');
    setPassword('');
    setConfirmPassword('');
  };

  return (
    <div class={styles.container}>
      <form class={styles.form} onSubmit={handleSubmit}>
        <h2 class={styles.title}>
          {isRegistering() ? 'Create Account' : 'Welcome Back'}
        </h2>

        <Show when={error()}>
          <div class={styles.error}>{error()}</div>
        </Show>

        <Show when={isRegistering()}>
          <div class={styles.inputGroup}>
            <label class={styles.label} for="email">
              Email
            </label>
            <input
              type="email"
              id="email"
              class={styles.input}
              value={email()}
              onInput={(e) => setEmail(e.currentTarget.value)}
              placeholder="you@example.com"
              disabled={isLoading()}
            />
          </div>
        </Show>

        <div class={styles.inputGroup}>
          <label class={styles.label} for="username">
            {isRegistering() ? 'Username' : 'Username or Email'}
          </label>
          <input
            type="text"
            id="username"
            class={styles.input}
            value={username()}
            onInput={(e) => setUsername(e.currentTarget.value)}
            placeholder={isRegistering() ? 'johndoe' : 'johndoe or you@example.com'}
            disabled={isLoading()}
          />
        </div>

        <div class={styles.inputGroup}>
          <label class={styles.label} for="password">
            Password
          </label>
          <input
            type="password"
            id="password"
            class={styles.input}
            value={password()}
            onInput={(e) => setPassword(e.currentTarget.value)}
            placeholder="••••••••"
            disabled={isLoading()}
          />
        </div>

        <Show when={isRegistering()}>
          <div class={styles.inputGroup}>
            <label class={styles.label} for="confirmPassword">
              Confirm Password
            </label>
            <input
              type="password"
              id="confirmPassword"
              class={styles.input}
              value={confirmPassword()}
              onInput={(e) => setConfirmPassword(e.currentTarget.value)}
              placeholder="••••••••"
              disabled={isLoading()}
            />
          </div>
        </Show>

        <button type="submit" class={styles.button} disabled={isLoading()}>
          {isLoading() ? 'Please wait...' : (isRegistering() ? 'Register' : 'Login')}
        </button>

        <Show when={!isRegistering()}>
          <div class={styles.forgotPassword}>
            <button 
              type="button" 
              class={styles.forgotPasswordLink}
              onClick={() => setShowForgotPassword(true)}
              disabled={isLoading()}
            >
              Forgot Password?
            </button>
          </div>
        </Show>

        <div class={styles.switchForm}>
          {isRegistering() ? 'Already have an account?' : "Don't have an account?"}
          {' '}
          <button type="button" onClick={switchMode} disabled={isLoading()}>
            {isRegistering() ? 'Login' : 'Register'}
          </button>
        </div>

        <div class={styles.divider}>
          <span>OR</span>
        </div>

        <button 
          type="button" 
          class={styles.offlineButton}
          onClick={() => props.onSuccess({ offline: true })}
          disabled={isLoading()}
        >
          Continue Offline
        </button>
      </form>
      
      <Show when={showForgotPassword()}>
        <ForgotPassword 
          onClose={() => setShowForgotPassword(false)}
          onBackToLogin={() => setShowForgotPassword(false)}
        />
      </Show>
    </div>
  );
};