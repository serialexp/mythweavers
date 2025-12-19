import { useQueryClient } from '@tanstack/react-query'
import { getQueryKey } from '@trpc/react-query'
import { Bookmark, DashFlag, Star } from 'iconoir-react'
import { closeAddToBookshelf } from '../slices/bookshelf-slice'
import { useAppDispatch } from '../store'
import { trpc } from '../utils/trpc'

export const AddToBookshelf = ({ storyId, isOpen }: { storyId: string; isOpen: boolean }) => {
  const setBookshelfState = trpc.setBookshelfState.useMutation()
  const { data: bookshelfState } = trpc.checkBookshelfState.useQuery({
    storyId,
  })
  const dispatch = useAppDispatch()
  const queryClient = useQueryClient()

  const handleSave = (type: 'FAVORITE' | 'FOLLOW' | 'READ_LATER', action: 'ADD' | 'REMOVE') => {
    setBookshelfState
      .mutateAsync({
        storyId: storyId,
        kind: type,
        action: action,
      })
      .then(() => {
        queryClient.invalidateQueries({
          queryKey: getQueryKey(trpc.getBookshelfStories),
        })
        dispatch(closeAddToBookshelf())
      })
  }

  return isOpen ? (
    <dialog className="modal modal-open">
      <div className="modal-box max-w-xl">
        <h3 className="font-bold text-lg text-center">Add Book to Saved</h3>
        <div className="py-4">
          <div className="flex flex-row justify-center gap-2">
            <button
              type="button"
              className={`btn ${bookshelfState?.FAVORITE ? 'btn-error' : 'btn-secondary'}`}
              onClick={() => handleSave('FAVORITE', bookshelfState?.FAVORITE ? 'REMOVE' : 'ADD')}
            >
              <Star className="icon" />
              {bookshelfState?.FAVORITE ? 'Unfavorite' : 'Favorite'}
            </button>
            <button
              type="button"
              className={`btn ${bookshelfState?.FOLLOW ? 'btn-error' : 'btn-secondary'}`}
              onClick={() => handleSave('FOLLOW', bookshelfState?.FOLLOW ? 'REMOVE' : 'ADD')}
            >
              <DashFlag className="icon" />
              {bookshelfState?.FOLLOW ? 'Unfollow' : 'Follow'}
            </button>
            <button
              type="button"
              className={`btn ${bookshelfState?.READ_LATER ? 'btn-error' : 'btn-secondary'}`}
              onClick={() => handleSave('READ_LATER', bookshelfState?.READ_LATER ? 'REMOVE' : 'ADD')}
            >
              <Bookmark className="icon" />
              {bookshelfState?.READ_LATER ? 'Remove Read Later' : 'Read Later'}
            </button>
          </div>
        </div>
      </div>
      <form method="dialog" className="modal-backdrop">
        <button type="button" onClick={() => dispatch(closeAddToBookshelf())}>
          close
        </button>
      </form>
    </dialog>
  ) : null
}
