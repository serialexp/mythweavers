import { join } from '@tauri-apps/api/path'
import { stat, writeTextFile } from '@tauri-apps/plugin-fs'
import type { PersistedStory, Story, StorySettings } from '@writer/shared'
import short from 'short-uuid'
import { createStore } from 'solid-js/store'

type StoryStateProperties = Pick<
  Story,
  'id' | 'name' | 'modifiedTime' | 'settings' | 'uploadedFiles' | 'lastPublishTime' | 'oneliner'
>

const storyStateDefault = {
  story: {
    id: short.generate(),
    name: '',
    modifiedTime: 0,
    settings: {
      defaultPerspective: 'first' as const,
    },
    uploadedFiles: {},
    lastPublishTime: 0,
  },
  expectedLastModified: 0,
  storyLoaded: false,
}
export const [storyState, setStoryState] = createStore<{
  story: StoryStateProperties | undefined
  openPath?: string
  expectedLastModified: number
  storyLoaded: boolean
}>(storyStateDefault)

export const resetStoryState = () => {
  setStoryState({
    story: {
      id: short.generate(),
      name: '',
      modifiedTime: 0,
      settings: {
        defaultPerspective: 'first' as const,
      },
      uploadedFiles: {},
      lastPublishTime: 0,
    },
    expectedLastModified: 0,
    storyLoaded: false,
  })
}

export const setStory = (story: StoryStateProperties) => {
  setStoryState('story', {
    id: story.id,
    name: story.name,
    modifiedTime: story.modifiedTime,
    settings: story.settings,
    uploadedFiles: story.uploadedFiles,
    lastPublishTime: story.lastPublishTime,
    oneliner: story.oneliner,
  })
  setStoryState('storyLoaded', true)
}

// New functions to update the moved properties
export const newStory = async (opts: { name: string; projectPath: string }) => {
  const id = short.generate()
  setStoryState('openPath', opts.projectPath)
  const storyFile = await join(opts.projectPath, 'index.json')
  const story = {
    name: opts.name,
    id,
    oneliner: '',
    settings: {
      defaultPerspective: 'first' as const,
    },
    structure: [],
    book: {},
    arc: {},
    chapter: {},
    scene: {},
    characters: {},
    plotPoints: {},
    locations: {},
    modifiedTime: 0,
  }
  writeTextFile(
    storyFile,
    JSON.stringify(
      {
        story,
        language: {
          languages: {},
        },
      } satisfies PersistedStory,
      null,
      2,
    ),
  )
  const newFileStat = await stat(storyFile)
  setStoryState('story', {
    ...story,
    modifiedTime: newFileStat.mtime ? newFileStat.mtime.getTime() : 0,
  })
  setExpectedLastModified(newFileStat.mtime ? newFileStat.mtime.getTime() : 0)
  setStoryLoaded(true)
}

// TODO: Think add a function here to load a story from the disk

export const setOpenPath = (path: string) => setStoryState('openPath', path)
export const setExpectedLastModified = (time: number) => setStoryState('expectedLastModified', time)
export const setStoryLoaded = (loaded: boolean) => setStoryState('storyLoaded', loaded)
export const unloadStory = () => {
  setStoryState('story', undefined)
  setStoryState('openPath', undefined)
  setStoryState('expectedLastModified', 0)
  setStoryState('storyLoaded', false)
}

export const setStoryProperty = <K extends keyof StoryStateProperties>(property: K, value: StoryStateProperties[K]) => {
  setStoryState('story', property, value)
  setStoryState('story', 'modifiedTime', Date.now())
}

export const setStorySetting = <K extends keyof StorySettings>(property: K, value: StorySettings[K]) => {
  setStoryState('story', 'settings', property, value)
  setStoryState('story', 'modifiedTime', Date.now())
}
