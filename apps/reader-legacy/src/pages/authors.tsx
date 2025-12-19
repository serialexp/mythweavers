import { Helmet } from 'react-helmet'
import { trpc } from '../utils/trpc'

export const AuthorsPage = () => {
  const { data: authorsData, isLoading, error } = trpc.authorList.useQuery()

  if (isLoading) {
    return <div className="flex justify-center items-center h-screen">Loading...</div>
  }

  if (error) {
    return <div className="text-red-500">Error: {error.message}</div>
  }

  return (
    <>
      <Helmet>
        <title>Authors - Reader</title>
      </Helmet>
      <h1 className="text-3xl font-bold mb-6">Authors</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {authorsData?.map((author) => (
          <div key={author.id} className="card bg-base-100 shadow-xl">
            <div className="card-body">
              <h2 className="card-title">{author.name}</h2>
              <p>{author._count.ownedStories} stories</p>
              <div className="card-actions justify-end">
                <a href={`/author/${author.id}`} className="btn btn-primary">
                  View Profile
                </a>
              </div>
            </div>
          </div>
        ))}
      </div>
    </>
  )
}
