import {
  Alert,
  Button,
  Card,
  CardBody,
  Container,
  FormField,
  Heading,
  Input,
  Stack,
} from "@mythweavers/ui"
import { Show, createSignal } from "solid-js"
import { postAuthLogin } from "../api/config"

interface LoginFormProps {
  onSuccess: () => void
}

export function LoginForm(props: LoginFormProps) {
  const [username, setUsername] = createSignal("")
  const [password, setPassword] = createSignal("")
  const [error, setError] = createSignal<string | null>(null)
  const [isLoading, setIsLoading] = createSignal(false)

  const handleSubmit = async (e: Event) => {
    e.preventDefault()
    setError(null)
    setIsLoading(true)

    try {
      const usernameVal = username().trim()
      const passwordVal = password()

      if (!usernameVal || !passwordVal) {
        setError("Please fill in all fields")
        setIsLoading(false)
        return
      }

      const result = await postAuthLogin({
        body: { username: usernameVal, password: passwordVal },
      })

      if (result.data) {
        props.onSuccess()
      } else if (result.error) {
        const msg =
          typeof result.error === "object" && "error" in result.error
            ? (result.error as { error?: string }).error
            : undefined
        setError(msg || "Login failed")
      } else {
        setError("Login failed - no response from server")
      }
    } catch (err) {
      if (err instanceof TypeError) {
        setError(
          "Cannot connect to server. Check the API URL and ensure the server is running.",
        )
      } else if (err instanceof Error) {
        setError(`Login error: ${err.message}`)
      } else {
        setError("An unexpected error occurred")
      }
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Container size="sm" padding="lg" center>
      <Stack
        direction="vertical"
        gap="lg"
        align="center"
        style={{ "padding-top": "4rem" }}
      >
        <Card size="sm" style={{ width: "100%", "max-width": "400px" }}>
          <CardBody padding="lg" gap="md">
            <Heading level={1} size="2xl">
              Admin Login
            </Heading>

            <Show when={error()}>
              <Alert variant="error">{error()}</Alert>
            </Show>

            <form onSubmit={handleSubmit}>
              <FormField
                label="Email or Username"
                style={{ "margin-bottom": "1rem" }}
              >
                <Input
                  id="username"
                  type="text"
                  name="username"
                  value={username()}
                  onInput={(e) => setUsername(e.currentTarget.value)}
                  disabled={isLoading()}
                />
              </FormField>

              <FormField
                label="Password"
                style={{ "margin-bottom": "1.5rem" }}
              >
                <Input
                  id="password"
                  type="password"
                  name="password"
                  value={password()}
                  onInput={(e) => setPassword(e.currentTarget.value)}
                  disabled={isLoading()}
                />
              </FormField>

              <Button
                type="submit"
                variant="primary"
                fullWidth
                disabled={isLoading()}
              >
                {isLoading() ? "Signing In..." : "Sign In"}
              </Button>
            </form>
          </CardBody>
        </Card>
      </Stack>
    </Container>
  )
}
