import { Preview } from '../components/Preview'
import { WriteHeaderMenu } from '../components/WriteHeaderMenu'

const PreviewPage = () => {
  return (
    <div class="flex flex-col h-full">
      <WriteHeaderMenu />
      <div class="flex flex-1 overflow-hidden">
        <Preview />
      </div>
    </div>
  )
}

export default PreviewPage
