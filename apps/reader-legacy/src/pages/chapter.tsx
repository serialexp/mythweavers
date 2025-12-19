import { useEffect, useState } from 'react'
import { useLocation, useParams } from 'wouter'
import { trpc } from '../utils/trpc' // Assuming you have a trpc setup

import { Helmet } from 'react-helmet'
import Divider from '../assets/divider.svg' // Adjust the path as necessary
import { useColorMode } from '../hooks/use-color-mode'

const ChapterPage = () => {
  const { chapterId, storyId, bookId } = useParams<{
    chapterId: string
    storyId: string
    bookId: string
  }>()
  const [_location, setLocation] = useLocation()
  const [isBacktracking, setIsBacktracking] = useState(false)
  const colorMode = useColorMode()
  const { data, error, isLoading } = trpc.getChapter.useQuery({ chapterId })
  const { mutateAsync: updateStoryReadStatus } = trpc.updateStoryReadStatus.useMutation()

  // Function to navigate to a different chapter
  const navigateToChapter = (newChapterId: string) => {
    setIsBacktracking(false)
    window.scrollTo(0, 0)
    setLocation(`/story/${storyId}/book/${bookId}/chapter/${newChapterId}`)
  }

  useEffect(() => {
    updateStoryReadStatus({
      storyId,
      lastChapterId: chapterId,
    }).then((res) => {
      if (!res.success) {
        setIsBacktracking(true)
      }
    })
  }, [chapterId, storyId, updateStoryReadStatus])

  if (isLoading) return <div>Loading...</div>
  if (error) return <div>Error loading chapter</div>

  return (
    <div className="p-4 max-w-2xl mx-auto bg-white text-black dark:bg-slate-900 dark:text-white">
      <Helmet>
        <title>{data?.name} - Reader</title>
      </Helmet>
      <h1 className="text-2xl font-bold mb-4 text-black dark:text-white">{data?.name}</h1>
      {isBacktracking ? (
        <div className="flex flex-col gap-4 my-4">
          <div className="alert alert-info">
            <p>
              It seems you have already read this chapter. If you want to reset your reading progress, click the button
              below.
            </p>
          </div>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => {
              updateStoryReadStatus({
                storyId,
                lastChapterId: chapterId,
                override: true,
              }).then((res) => {
                if (res.success) {
                  setIsBacktracking(false)
                }
              })
            }}
          >
            Reset Reading Progress
          </button>
        </div>
      ) : null}
      {data?.scenes.map((scene, index) => (
        <div key={scene.id} className="mb-6">
          {/* Separator between scenes */}
          {index > 0 && (
            <img
              src={Divider}
              alt="Scene Divider"
              style={{
                filter: colorMode === 'dark' ? 'invert(1)' : 'invert(0)',
              }}
              className="my-8 m-auto max-w-60"
            />
          )}
          {scene.paragraphs.map((paragraph) => (
            <p key={paragraph.id} className="mb-4 text-gray-700 dark:text-gray-300">
              {paragraph.latestRevision.body}
            </p>
          ))}
        </div>
      ))}
      {/* Navigation buttons */}
      <div className="flex justify-between mt-8">
        <button
          type="button"
          onClick={() => navigateToChapter(data?.previousChapterId)}
          disabled={!data?.previousChapterId}
          className="px-4 py-2 bg-blue-500 text-white rounded disabled:opacity-50"
        >
          Previous Chapter
        </button>
        <button
          type="button"
          onClick={() => navigateToChapter(data?.nextChapterId)}
          disabled={!data?.nextChapterId}
          className="px-4 py-2 bg-blue-500 text-white rounded disabled:opacity-50"
        >
          Next Chapter
        </button>
      </div>
    </div>
  )
}

export { ChapterPage }
