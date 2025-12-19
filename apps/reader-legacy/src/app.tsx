import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { httpBatchLink } from '@trpc/client'
import './index.css'
import { useState } from 'react'
import { Provider } from 'react-redux'
import { Route, Switch } from 'wouter'
import { Layout } from './components/layout'
import { IndexPage } from './pages'
import { AdminPage } from './pages/admin'
import { AuthorPage } from './pages/author'
import { AuthorsPage } from './pages/authors'
import { BookshelfPage } from './pages/bookshelf'
import { ChapterPage } from './pages/chapter'
import { DownloadPage } from './pages/download'
import { ListsPage } from './pages/lists'
import { LoginPage } from './pages/login'
import { MyFictionPage } from './pages/my-fiction'
import { SearchPage } from './pages/search'
import { UserSettingsPage } from './pages/settings'
import { StoriesPage } from './pages/stories'
import { StoryPage } from './pages/story'
import store from './store'
import { trpc } from './utils/trpc'
export const App = () => {
  const [queryClient] = useState(() => new QueryClient())
  const [trpcClient] = useState(() =>
    trpc.createClient({
      links: [
        httpBatchLink({
          url: window.location.host.includes('localhost')
            ? 'http://localhost:2022/trpc'
            : 'https://writer.serial-experiments.com/trpc',
          // You can pass any HTTP headers you wish here
          async headers() {
            return {
              Authorization: `Bearer ${localStorage.getItem('sessionToken')}`,
            }
          },
        }),
      ],
    }),
  )
  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <Provider store={store}>
          <Layout>
            <Switch>
              <Route path="/bookshelf" component={BookshelfPage} />
              <Route path="/" component={IndexPage} />
              <Route path="/authors" component={AuthorsPage} />
              <Route path="/author/:authorId" component={AuthorPage} />
              <Route path="/stories" component={StoriesPage} />
              <Route path="/stories/:genre" component={StoriesPage} />
              <Route path="/library" component={ListsPage} />
              <Route path="/download" component={DownloadPage} />
              <Route path="/admin" component={AdminPage} />
              <Route path="/my-fiction" component={MyFictionPage} />
              <Route path="/story/:storyId" component={StoryPage} />
              <Route path="/search" component={SearchPage} />
              <Route path="/login" component={LoginPage} />
              <Route path="/settings" component={UserSettingsPage} />
              <Route path="/story/:storyId/book/:bookId/chapter/:chapterId" component={ChapterPage} />
            </Switch>
          </Layout>
        </Provider>
      </QueryClientProvider>
    </trpc.Provider>
  )
}
