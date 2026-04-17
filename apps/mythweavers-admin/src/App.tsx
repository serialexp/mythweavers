import {
  Alert,
  Container,
  Heading,
  NavBar,
  NavBarBrand,
  NavBarNav,
  NavLink,
  Spinner,
  Stack,
  Text,
} from "@mythweavers/ui"
import { useLocation } from "@solidjs/router"
import { type JSX, Match, Show, Switch, createResource } from "solid-js"
import { getAuthSession, getAdminUsers } from "./api/config"
import * as styles from "./components/Layout.css"
import { LoginForm } from "./components/LoginForm"

type AuthState =
  | { status: "loading" }
  | { status: "not_authenticated" }
  | { status: "not_admin"; username: string }
  | { status: "ok" }

async function checkAdminAccess(): Promise<AuthState> {
  // 1. Check if logged in
  const session = await getAuthSession()
  if (!session.data?.authenticated) {
    return { status: "not_authenticated" }
  }

  // 2. Check if admin by making a lightweight admin call
  const res = await getAdminUsers({ query: { pageSize: 1 } })
  if (res.error) {
    return {
      status: "not_admin",
      username: session.data.user?.username ?? "unknown",
    }
  }

  return { status: "ok" }
}

export function App(props: { children?: JSX.Element }) {
  const location = useLocation()
  const [auth, { refetch }] = createResource(checkAdminAccess)

  return (
    <div class={styles.layout}>
      <NavBar variant="elevated" position="sticky" size="md">
        <NavBarBrand href="/">MythWeavers Admin</NavBarBrand>
        <Show when={auth()?.status === "ok"}>
          <NavBarNav>
            <NavLink
              href="/providers"
              active={location.pathname.startsWith("/providers")}
            >
              LLM Providers
            </NavLink>
            <NavLink
              href="/users"
              active={location.pathname.startsWith("/users")}
            >
              Users
            </NavLink>
          </NavBarNav>
        </Show>
      </NavBar>

      <main class={styles.main}>
        <Switch>
          <Match when={auth.loading || auth()?.status === "loading"}>
            <Stack direction="horizontal" justify="center" style={{ "padding-top": "4rem" }}>
              <Spinner size="lg" />
            </Stack>
          </Match>

          <Match when={auth()?.status === "not_authenticated"}>
            <LoginForm onSuccess={() => refetch()} />
          </Match>

          <Match when={auth()?.status === "not_admin"}>
            <Container size="sm" padding="lg" center>
              <Stack direction="vertical" gap="lg" align="center" style={{ "padding-top": "4rem" }}>
                <Heading level={1} size="2xl">
                  Access Denied
                </Heading>
                <Alert variant="error" title="Admin access required">
                  <Text>
                    Logged in as{" "}
                    <strong>
                      {(auth() as { status: "not_admin"; username: string }).username}
                    </strong>
                    , but this account does not have admin privileges.
                  </Text>
                </Alert>
              </Stack>
            </Container>
          </Match>

          <Match when={auth()?.status === "ok"}>
            {props.children}
          </Match>
        </Switch>
      </main>
    </div>
  )
}
