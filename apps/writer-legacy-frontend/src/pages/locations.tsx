import { LocationPanel } from '../components/LocationPanel'
import { WriteHeaderMenu } from '../components/WriteHeaderMenu'

const Locations = () => {
  return (
    <div class="flex flex-col h-full">
      <WriteHeaderMenu />
      <div class="flex flex-1 overflow-hidden">
        <LocationPanel />
      </div>
    </div>
  )
}

export default Locations
