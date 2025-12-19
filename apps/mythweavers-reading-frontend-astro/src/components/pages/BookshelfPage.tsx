import { Card, CardBody, CardTitle, CardActions, Button, LinkButton } from '@mythweavers/ui'
import { Layout } from '../Layout'
import type { User } from '../../lib/api'
import * as pageStyles from '../../styles/pages.css'

export interface BookshelfPageProps {
  user: User
  initialTheme?: 'chronicle' | 'starlight'
}

export const BookshelfPage = (props: BookshelfPageProps) => {
  return (
    <Layout initialTheme={props.initialTheme} user={props.user}>
      <div class={pageStyles.pageContainer}>
        <Card>
          <CardBody padding="lg" gap="md">
            <CardTitle size="lg">My Bookshelf</CardTitle>
            <p style={{ color: 'var(--color-text-secondary__1wxbrr29)' }}>
              Welcome back, {props.user.username}!
            </p>

            <div class={pageStyles.storyGrid}>
              <Card variant="elevated">
                <CardBody>
                  <CardTitle>Your Collections</CardTitle>
                  <p style={{ color: 'var(--color-text-secondary__1wxbrr29)' }}>
                    No collections yet. Start organizing your stories!
                  </p>
                  <CardActions>
                    <Button variant="primary">Create Collection</Button>
                  </CardActions>
                </CardBody>
              </Card>

              <Card variant="elevated">
                <CardBody>
                  <CardTitle>Reading History</CardTitle>
                  <p style={{ color: 'var(--color-text-secondary__1wxbrr29)' }}>
                    No reading history yet. Start reading!
                  </p>
                  <CardActions>
                    <LinkButton href="/stories" variant="primary">Browse Stories</LinkButton>
                  </CardActions>
                </CardBody>
              </Card>

              <Card variant="elevated">
                <CardBody>
                  <CardTitle>Recommendations</CardTitle>
                  <p style={{ color: 'var(--color-text-secondary__1wxbrr29)' }}>
                    We'll recommend stories based on your reading history.
                  </p>
                  <CardActions>
                    <LinkButton href="/stories" variant="primary">Discover</LinkButton>
                  </CardActions>
                </CardBody>
              </Card>
            </div>
          </CardBody>
        </Card>
      </div>
    </Layout>
  )
}
