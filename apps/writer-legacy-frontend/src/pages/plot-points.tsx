import { PlotPointPanel } from '../components/PlotPointPanel'
import { WriteHeaderMenu } from '../components/WriteHeaderMenu'

const Home = () => {
  return (
    <div class="flex flex-col h-full">
      <WriteHeaderMenu />
      <div class="flex flex-1 overflow-hidden">
        <PlotPointPanel />
      </div>
    </div>
  )
}

export default Home
