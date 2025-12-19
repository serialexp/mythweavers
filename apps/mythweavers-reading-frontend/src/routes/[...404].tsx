import { LinkButton } from '@mythweavers/ui'
import { Meta, Title } from '@solidjs/meta'
import { Layout } from '~/components/Layout'
import * as pageStyles from '~/styles/pages.css'

export default function NotFound() {
  return (
    <Layout>
      <Title>404 - Page Not Found</Title>
      <Meta name="description" content="The page you were looking for doesn't exist" />

      <div class={pageStyles.centeredColumn} style={{ 'padding-top': '4rem', 'padding-bottom': '4rem' }}>
        <h1 class={pageStyles.pageTitle} style={{ 'font-size': '6rem', color: 'var(--color-semantic-error)' }}>
          404
        </h1>
        <p class={pageStyles.sectionTitle}>The page you're looking for cannot be found.</p>

        <LinkButton href="/" variant="primary">
          Go Home
        </LinkButton>
      </div>
    </Layout>
  )
}
