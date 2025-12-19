import { Button } from '@mythweavers/ui'
import { For } from 'solid-js'

const GENRES = ['Action', 'Adventure', 'Comedy', 'Drama', 'Fantasy', 'Horror', 'Mystery', 'Romance']

interface StoriesFilterProps {
  currentGenre?: string
  filterAbandoned: boolean
}

export default function StoriesFilter(props: StoriesFilterProps) {
  const navigate = (url: string) => {
    window.location.href = url
  }

  const toggleAbandoned = () => {
    const url = new URL(window.location.href)
    if (props.filterAbandoned) {
      url.searchParams.delete('filterAbandoned')
    } else {
      url.searchParams.set('filterAbandoned', 'true')
    }
    window.location.href = url.toString()
  }

  const selectGenre = (genre?: string) => {
    const url = new URL(window.location.href)
    if (genre) {
      url.searchParams.set('genre', genre)
    } else {
      url.searchParams.delete('genre')
    }
    url.searchParams.delete('page') // Reset pagination when changing genre
    window.location.href = url.toString()
  }

  return (
    <div style={{ display: 'flex', 'flex-direction': 'column', gap: '1rem' }}>
      <div style={{ display: 'flex', 'align-items': 'center', gap: '0.5rem' }}>
        <input
          type="checkbox"
          id="filter-abandoned"
          checked={props.filterAbandoned}
          onChange={toggleAbandoned}
        />
        <label for="filter-abandoned">Hide abandoned</label>
      </div>

      <div style={{ display: 'flex', 'flex-wrap': 'wrap', gap: '0.5rem' }}>
        <Button
          variant={!props.currentGenre ? 'primary' : 'secondary'}
          size="sm"
          onClick={() => selectGenre(undefined)}
        >
          All
        </Button>
        <For each={GENRES}>
          {(genre) => (
            <Button
              variant={props.currentGenre === genre ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => selectGenre(genre)}
            >
              {genre}
            </Button>
          )}
        </For>
      </div>
    </div>
  )
}
