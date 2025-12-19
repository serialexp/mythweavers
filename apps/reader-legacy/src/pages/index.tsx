import { Helmet } from 'react-helmet'
import StoryCard from '../components/storycard'
import { useColorMode } from '../hooks/use-color-mode'
import { useSignIn } from '../hooks/use-sign-in'
import { trpc } from '../utils/trpc'
import { version } from '../version'
export const IndexPage = () => {
  const { data: storiesData, isLoading, error, refetch } = trpc.listRandomStories.useQuery({ limit: 8 })
  const colorScheme = useColorMode()
  const { user } = useSignIn()
  if (isLoading) {
    return <div>Loading...</div>
  }

  if (error) {
    return <div>Error: {error.message}</div>
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-8">
      <Helmet>
        <title>Home - Reader</title>
      </Helmet>

      <img
        className="max-h-[400px]"
        src={colorScheme === 'dark' ? '/service-dark-small.png' : '/service-small.png'}
        alt="Banner"
      />

      <div className="flex flex-row overflow-x-hidden py-4 justify-around gap-6">
        {storiesData?.stories.map((story) => (
          <StoryCard
            key={story.id}
            id={story.id}
            summary={story.summary ?? ''}
            coverArtAsset={story.coverArtAsset}
            name={story.name}
            lastChapterReleasedAt={story.lastChapterReleasedAt}
            ownerName={story.owner.name ?? ''}
            pages={story.pages ?? 0}
            spellingLevel={story.spellingLevel ?? 0}
            color={story.coverColor}
            wordsPerWeek={story.wordsPerWeek ?? 0}
            textColor={story.coverTextColor}
            fontFamily={story.coverFontFamily}
            royalRoadId={story.royalRoadId ?? undefined}
            status={story.status}
            canAddToLibrary={!!user}
          />
        ))}
      </div>
      <button
        type="button"
        className="btn btn-primary"
        onClick={() => {
          refetch()
        }}
      >
        More! Show me more stories!
      </button>

      {/* Announcement Section */}
      <div className="announcement-section bg-blue-100 dark:bg-blue-900 p-4 rounded w-full">
        <h2 className="text-2xl font-semibold">Announcement</h2>
        <p className="mt-2">
          You might notice that the site is currently very bare bones. I'm working on adding more features and improving
          the site, but it's still a work in progress. Most of the content you see is actually from&nbsp;
          <a href="https://www.royalroad.com" target="_blank" rel="noreferrer">
            Royal Road
          </a>
          , and was mostly added to prevent the site from looking extremely sad. Any attempt to read those stories here
          will redirect you to Royal Road instead.
        </p>
        <p className="mt-2">
          Why a new web-novel site, when we already have Royal Road? Well, I wanted something that was more focused on
          improving the reading, writing and editing experience (yes, editing, good books are made by editing!). I'm
          also sad when I see so many novels stubbed due to Amazon contracts, so I'm hoping to add monetization directly
          to the platform which means we can retain it all and still earn money!
        </p>
        <p className="mt-2">
          There's also this thing with Royal Road where paying them to advertise your novel is a fantastic way to get
          readers, but it doesn't really feel fair, and leads to a lot of bad incentives. I want to make
          <i>every</i> story more discoverable.
        </p>
        <p className="mt-2 text-xs">
          Posted <time dateTime="2024-10-17">2024-10-17</time> by Aeolun
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card bg-base-200 dark:bg-base-800">
          <div className="card-body">
            <h2 className="card-title">Latest Releases</h2>
            <p>Check out the latest stories added to our collection.</p>
            <div className="card-actions justify-end">
              <button type="button" className="btn btn-secondary">
                Explore
              </button>
            </div>
          </div>
        </div>

        <div className="card bg-base-200 dark:bg-base-800">
          <div className="card-body">
            <h2 className="card-title">Join Our Community</h2>
            <p>Become a part of our vibrant community of writers and readers.</p>
            <div className="card-actions justify-end">
              <button type="button" className="btn btn-accent">
                Sign Up
              </button>
            </div>
          </div>
        </div>
        <div className="card bg-base-200 dark:bg-base-800">
          <div className="card-body">
            <h2 className="card-title">Here from RoyalRoad?</h2>
            <p>Import your existing RoyalRoad stories.</p>
            <div className="card-actions justify-end">
              <button type="button" className="btn btn-primary">
                Get Started
              </button>
            </div>
          </div>
        </div>
      </div>

      <footer className="mt-8 text-center">
        <p className="text-sm">
          © {new Date().getFullYear()} Reader. All rights reserved. Reader version {version}.
        </p>
      </footer>
    </div>
  )
}
