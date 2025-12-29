import { Button, Card, CardActions, CardBody, CardTitle } from '@mythweavers/ui'
import { Meta, Title } from '@solidjs/meta'
import { createAsync } from '@solidjs/router'
import { Show } from 'solid-js'
import { Layout } from '~/components/Layout'
import { type UserSession, requireUserSession } from '~/lib/session'
import * as pageStyles from '~/styles/pages.css'

// Type guard to check if the result is a UserSession
function isUserSession(value: Response | UserSession | null | undefined): value is UserSession {
  return value !== null && value !== undefined && !(value instanceof Response) && 'name' in value
}

// This route is protected - can only be accessed by logged-in users
export function routeData() {
  return createAsync(async () => {
    return await requireUserSession()
  })
}

export default function Bookshelf() {
  // Get user data from the route data
  const user = createAsync(() => requireUserSession())

  // Helper to get user name safely
  const getUserName = () => {
    const u = user()
    return isUserSession(u) ? u.name : 'Reader'
  }

  return (
    <Layout>
      <Title>My Bookshelf - Reader</Title>
      <Meta name="description" content="Your personal bookshelf" />

      <div class={pageStyles.mb6}>
        <h1 class={pageStyles.pageTitle}>My Bookshelf</h1>
        <p class={pageStyles.textSecondary}>Welcome back, {getUserName()}!</p>
      </div>

      <Show when={isUserSession(user())} fallback={<div>Please log in to view your bookshelf</div>}>
        <div class={pageStyles.storyGrid}>
          <Card variant="elevated">
            <CardBody>
              <CardTitle>Your Collections</CardTitle>
              <p class={pageStyles.textSecondary}>No collections yet. Start organizing your stories!</p>
              <CardActions>
                <Button variant="primary">Create Collection</Button>
              </CardActions>
            </CardBody>
          </Card>

          <Card variant="elevated">
            <CardBody>
              <CardTitle>Reading History</CardTitle>
              <p class={pageStyles.textSecondary}>No reading history yet. Start reading!</p>
              <CardActions>
                <Button variant="primary">Browse Stories</Button>
              </CardActions>
            </CardBody>
          </Card>

          <Card variant="elevated">
            <CardBody>
              <CardTitle>Recommendations</CardTitle>
              <p class={pageStyles.textSecondary}>We'll recommend stories based on your reading history.</p>
              <CardActions>
                <Button variant="primary">Discover</Button>
              </CardActions>
            </CardBody>
          </Card>
        </div>
      </Show>
    </Layout>
  )
}
