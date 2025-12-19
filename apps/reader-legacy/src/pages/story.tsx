import { Helmet } from 'react-helmet'
import { Link, useParams } from 'wouter'
import { trpc } from '../utils/trpc'

export const StoryPage = () => {
  const { storyId } = useParams()
  const { data: story, isLoading, error } = trpc.getStory.useQuery({ storyId: storyId ?? '' })

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-t-2 border-b-2 border-blue-500" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="text-red-500 dark:text-red-400 text-2xl">Error: {error.message}</div>
      </div>
    )
  }

  if (!story) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="text-gray-500 dark:text-gray-400 text-2xl">Story not found</div>
      </div>
    )
  }

  return (
    <div className="bg-white dark:bg-gray-800 shadow-lg rounded-lg overflow-hidden">
      <Helmet>
        <title>{story.name} - Reader</title>
      </Helmet>
      <div className="p-6">
        <h1 className="text-3xl font-bold mb-2 text-black dark:text-white">{story.name}</h1>
        <p className="text-gray-600 dark:text-gray-400 mb-4">by {story.owner.name}</p>
        <p className="text-gray-700 dark:text-gray-300 mb-4">{story.pages} pages</p>
        <div className="mb-6">
          <h2 className="text-xl font-semibold mb-2 text-black dark:text-white">Books</h2>
          {story.books.map((book) => (
            <div key={book.id} className="mb-4">
              <h3 className="text-lg font-medium text-black dark:text-white">{book.name}</h3>
              <p className="text-gray-600 dark:text-gray-400">{book.pages} pages</p>
              <div className="mt-2">
                <h4 className="text-md font-medium text-black dark:text-white">Chapters:</h4>
                <ul className="list-disc list-inside">
                  {book.chapters.map((chapter) => (
                    <li key={chapter.id} className="text-gray-700 dark:text-gray-300">
                      <Link
                        href={`/story/${storyId}/book/${book.id}/chapter/${chapter.id}`}
                        className="hover:underline text-blue-500 dark:text-blue-400"
                      >
                        {chapter.name}
                      </Link>
                      {chapter.publishedOn && (
                        <span className="text-gray-500 dark:text-gray-400 text-sm ml-2">
                          (Published: {new Date(chapter.publishedOn).toLocaleDateString()})
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
        <div className="flex justify-between items-center text-sm text-gray-500 dark:text-gray-400">
          <p>Created: {new Date(story.createdAt).toLocaleDateString()}</p>
          <p>Updated: {new Date(story.updatedAt).toLocaleDateString()}</p>
        </div>
      </div>
    </div>
  )
}
