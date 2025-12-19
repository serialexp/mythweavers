import { authorList } from './procedures/author-list.js'
import { checkBookshelfState } from './procedures/check-bookshelf-state.js'
import { checkStoryDifferences } from './procedures/check-story-differences.js'
import { connectedClients } from './procedures/connected-clients.js'
import { downloadFiles } from './procedures/download-files.js'
import { downloadStory } from './procedures/download-story.js'
import { getBookshelfStories } from './procedures/get-bookshelf-stories.js'
import { getChapter } from './procedures/get-chapter.js'
import { getReleases } from './procedures/get-releases.js'
import { getStoryStatus } from './procedures/get-story-status.js'
import { getStory } from './procedures/get-story.js'
import { importRoyalRoad } from './procedures/import-royal-road.js'
import { listRandomStories } from './procedures/list-random-stories.js'
import { listStories } from './procedures/list-stories.js'
import { login } from './procedures/login.js'
import { logout } from './procedures/logout.js'
import { getUserStories } from './procedures/my-fiction.js'
import { publishStory } from './procedures/publish-story.js'
import { publishToRoyalRoad } from './procedures/publish-to-royal-road.js'
import { randomizeOrder } from './procedures/randomize-order.js'
import { register } from './procedures/register.js'
import { searchStories } from './procedures/search-stories.js'
import { sessionLogin } from './procedures/sessionLogin.js'
import { sessionSignout } from './procedures/sessionSignout.js'
import { setBookshelfState } from './procedures/set-bookshelf-state.js'
import { syncRoyalRoadPublishingProcedure } from './procedures/sync-royal-road-publishing.js'
import { updateAvatar } from './procedures/update-avatar.js'
import { updatePassword } from './procedures/update-password.js'
import { updateStoryReadStatus } from './procedures/update-story-read-status.js'
import { updateClientName } from './procedures/updateClientName.js'
import { updateName } from './procedures/updateName.js'
import { uploadStoryImage } from './procedures/upload-story-image.js'
import { uploadStory } from './procedures/upload-story.js'
import { uploadUserImage } from './procedures/upload-user-image.js'
import { listUploadedFiles } from './procedures/uploaded-files.js'
import { userById } from './procedures/user-by-id.js'
import { userList } from './procedures/user-list.js'
import { whoAmI } from './procedures/who-am-i.js'
import { router } from './trpc.js'

export const appRouter = router({
  userList: userList,
  importRoyalroad: importRoyalRoad,
  uploadStoryImage: uploadStoryImage,
  uploadStory: uploadStory,
  downloadStory: downloadStory,
  downloadFiles: downloadFiles,
  userById: userById,
  whoAmI: whoAmI,
  randomizeOrder: randomizeOrder,
  register: register,
  logout: logout,
  connectedClients: connectedClients,
  listStories: listStories,
  getStory: getStory,
  login: login,
  sessionLogin: sessionLogin,
  getChapter: getChapter,
  sessionSignout: sessionSignout,
  listUploadedFiles: listUploadedFiles,
  getBookshelfStories: getBookshelfStories,
  authorList: authorList,
  getStoryStatus: getStoryStatus,
  publishStory: publishStory,
  getReleases: getReleases,
  listRandomStories: listRandomStories,
  setBookshelfState: setBookshelfState,
  checkBookshelfState: checkBookshelfState,
  updateStoryReadStatus: updateStoryReadStatus,
  myFiction: getUserStories,
  publishToRoyalRoad: publishToRoyalRoad,
  updatePassword: updatePassword,
  searchStories: searchStories,
  updateClientName: updateClientName,
  updateAvatar: updateAvatar,
  uploadUserImage: uploadUserImage,
  updateName: updateName,
  syncRoyalRoadPublishing: syncRoyalRoadPublishingProcedure,
  checkStoryDifferences: checkStoryDifferences,
})

// Export type router type signature,
// NOT the router itself.
export type AppRouter = typeof appRouter
