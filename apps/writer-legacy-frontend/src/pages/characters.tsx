import { CharacterPanel } from '../components/CharacterPanel'
import { WriteHeaderMenu } from '../components/WriteHeaderMenu'

const Characters = () => {
  return (
    <div class="flex flex-col h-full">
      <WriteHeaderMenu />
      <div class="flex flex-1 overflow-hidden">
        <CharacterPanel />
      </div>
    </div>
  )
}

export default Characters
