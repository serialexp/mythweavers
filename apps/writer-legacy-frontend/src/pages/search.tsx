import { SearchPane } from '../components/SearchPane.tsx'
import { WriteHeaderMenu } from '../components/WriteHeaderMenu.tsx'

const Search = () => {
  return (
    <div class="flex flex-col h-full">
      <WriteHeaderMenu />
      <div class="flex flex-1 overflow-hidden">
        <SearchPane />
      </div>
    </div>
  )
}

export default Search
