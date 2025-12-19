import axios from 'axios'
import { globalActions } from '../slices/global'
import { store } from '../store'

export const sync = async () => {
  store.dispatch(globalActions.setSyncing(true))
  const { base, ...rest } = store.getState()
  axios.post(`/api/sync/${rest.story.name}`).then((_result) => {
    store.dispatch(globalActions.setSyncing(false))
  })
}
