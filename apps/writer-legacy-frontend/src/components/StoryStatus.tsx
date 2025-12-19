import { useDispatch } from 'react-redux'

import { Button } from '@chakra-ui/react'
import { addNotification } from '../lib/slices/notifications'
import { trpc, trpcReact } from '../lib/trpc'

const StoryStatus = ({ storyId }: { storyId: string }) => {
  const dispatch = useDispatch()
  const { data: storyStatus, isLoading, error, refetch } = trpcReact.getStoryStatus.useQuery({ storyId })

  if (isLoading) return <p>Loading...</p>
  if (error) return <p>Error loading story status</p>

  const handlePublish = async () => {
    try {
      await trpc.publishStory.mutate({ storyId, publish: true })
      dispatch(
        addNotification({
          message: 'Story published',
          type: 'success',
        }),
      )
      await refetch()
    } catch (error) {
      console.error('Error publishing story:', error)
      dispatch(
        addNotification({
          message: 'Error publishing story',
          type: 'error',
        }),
      )
    }
  }

  const handleUnpublish = async () => {
    try {
      await trpc.publishStory.mutate({ storyId, publish: false })
      dispatch(
        addNotification({
          message: 'Story unpublished',
          type: 'success',
        }),
      )
      await refetch()
    } catch (error) {
      console.error('Error unpublishing story:', error)
      dispatch(
        addNotification({
          message: 'Error unpublishing story',
          type: 'error',
        }),
      )
    }
  }

  return (
    <div>
      <p>Status: {storyStatus?.published ? 'Published' : 'Not Published'}</p>
      {storyStatus && !storyStatus.published && <Button onClick={handlePublish}>Publish Story</Button>}
      {storyStatus?.published && <Button onClick={handleUnpublish}>Unpublish Story</Button>}
    </div>
  )
}

export default StoryStatus
