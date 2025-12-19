import { Book } from '../components/book'
import { trpc } from '../utils/trpc'
import '../book.css'
import { useSignIn } from '../hooks/use-sign-in'

type BookType = {
  title: string
  author: string
  color: string
  textColor: string
  id: string
  cover: string
  pages: number
}

export const BookshelfPage = () => {
  const stories = trpc.listStories.useQuery({
    limit: 500,
  })

  const { user } = useSignIn()

  const pagesPerShelf = Math.round(2200 * (window.innerWidth / 1440))
  const shelves: BookType[][] = []
  let currentShelf: BookType[] = []
  let currentPageCount = 0
  let totalPageCount = 0
  for (const book of stories.data?.stories ?? []) {
    const pages = Math.max(Math.round((book.pages ?? 0) / 20), 40)
    if (currentPageCount + pages > pagesPerShelf) {
      shelves.push(currentShelf)
      currentShelf = []
      currentPageCount = 0
    }

    currentShelf.push({
      title: book.name,
      author: book.owner.name,
      color: book.coverColor,
      textColor: book.coverTextColor,
      id: book.id,
      cover: book.coverArtAsset,
      pages: book.pages ?? 0,
    })
    currentPageCount += pages
    totalPageCount += book.pages ?? 0
  }

  return (
    <div
      style={{
        margin: '0 auto',
        backgroundColor: '#000',
        padding: '1rem',
      }}
    >
      {shelves.map((shelf) => {
        return (
          <div className="shelf">
            <div className="shelf-contents">
              {shelf.map((book) => (
                <Book
                  key={book.title}
                  title={book.title}
                  author={book.author}
                  spineColor={book.color}
                  spineTextColor={book.textColor}
                  image={book.cover}
                  pages={book.pages}
                />
              ))}
            </div>
          </div>
        )
      })}
      <div>
        <h1 style={{ textAlign: 'center' }}>
          {shelves.length} shelves, {totalPageCount} pages, takes {Math.round(totalPageCount / 50)}h to read
        </h1>
      </div>
    </div>
  )
}
