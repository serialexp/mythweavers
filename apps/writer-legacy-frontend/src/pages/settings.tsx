import { StorySettings } from '../components/StorySettings'
import { WriteHeaderMenu } from '../components/WriteHeaderMenu'

const Profile = () => {
  return (
    <div class="flex flex-col h-full">
      <WriteHeaderMenu />
      <div class="flex flex-1 overflow-hidden">
        <StorySettings />
      </div>
    </div>
  )
}

export default Profile
