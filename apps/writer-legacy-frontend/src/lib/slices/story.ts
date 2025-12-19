import { type Draft, type PayloadAction, createSlice } from '@reduxjs/toolkit'
import type { Arc, Book, Chapter, Character, InventoryAction, Node, Scene, SceneParagraph, Story } from '@writer/shared'
import short from 'short-uuid'
import { removeEntityFromEmbeddingsCache } from '../embeddings/load-story-to-embeddings.ts'

const initialState: Story = {
  id: short.generate(),
  name: '',
  modifiedTime: Date.now(),
  chapter: {},
  structure: [],
  book: {},
  arc: {},
  characters: {},
  plotPoints: {},
  scene: {},
}

function addItemToStructure(
  structure: Array<any>,
  parentId: string | undefined,
  item: Node,
  index?: number,
  depth = 0,
) {
  if (depth > 4) {
    return
  }
  if (!parentId) {
    structure.push(item)
  } else {
    const parent = structure.find((i) => {
      return i.id === parentId
    })
    if (parent) {
      if (index !== undefined) {
        parent.children.splice(index, 0, item)
      } else {
        parent.children.push(item)
      }
      return
    }

    for (const i in structure) {
      const node = structure[i]
      if (node.children) {
        addItemToStructure(node.children, parentId, item, index, depth + 1)
      }
    }
  }
}

export function findNodeInStructure(structure: Array<Node>, id: string, depth = 0): Node | undefined {
  if (depth > 4) {
    return
  }
  for (let i = 0; i < structure.length; i++) {
    const node = structure[i]
    if (node.id === id) {
      return node
    }
    if (node.children) {
      const found = findNodeInStructure(node.children, id, depth + 1)
      if (found) {
        return found
      }
    }
  }
}

function findParentIdForNode(
  structure: Array<Node>,
  id: string,
  parentId: string | undefined,
  depth = 0,
): string | undefined {
  if (depth > 4) {
    return
  }
  for (let i = 0; i < structure.length; i++) {
    const node = structure[i]
    if (node.id === id) {
      return parentId
    }
    if (node.children) {
      const parentId = findParentIdForNode(node.children, id, node.id, depth + 1)
      if (parentId) {
        return parentId
      }
    }
  }
}

function updateItemInStructure(structure: Array<Node>, id: string, item: Partial<Node>, depth = 0) {
  if (depth > 4) {
    return
  }
  for (let i = 0; i < structure.length; i++) {
    const node = structure[i]
    if (node.id === id) {
      for (const key of Object.keys(item)) {
        const writableKey = key as keyof Node
        // @ts-expect-error: too broad
        node[writableKey] = item[writableKey]
      }
      return
    }
    if (node.children) {
      updateItemInStructure(node.children, id, item, depth + 1)
    }
  }
}

function removeItemFromStructure(structure: Array<any>, id: string, depth = 0): Node | undefined {
  if (depth > 4) {
    return
  }
  for (let i = 0; i < structure.length; i++) {
    const node = structure[i]
    if (node.id === id) {
      const item = structure[i]
      structure.splice(i, 1)
      return item
    }
    if (node.children) {
      const item = removeItemFromStructure(node.children, id, depth + 1)
      if (item) {
        return item
      }
    }
  }
}

export const globalSlice = createSlice({
  name: 'base',
  initialState,
  reducers: {
    setStory: (state, action: PayloadAction<Story>) => {
      for (const key in action.payload) {
        const storyKey = key as keyof Story

        state[storyKey] = action.payload[storyKey]
      }
    },
    toggleTreeItem: (_state, _action: PayloadAction<{ id: string }>) => {},
    newStory: (state, action: PayloadAction<string>) => {
      state.name = action.payload
    },
    unload: (_state) => {
      return initialState
    },
    setSetting(
      state: Draft<Story>,
      action: PayloadAction<{
        key: keyof Story['settings']
        value: string
      }>,
    ) {
      if (!state.settings) {
        state.settings = {}
      }
      if (state.settings) {
        state.modifiedTime = Date.now()
        state.settings[action.payload.key] = action.payload.value
      }
    },
    createChapter: (state, action: PayloadAction<{ arcId: string }>) => {
      const newId = short.generate().toString()
      state.chapter[newId] = {
        id: newId,
        modifiedAt: Date.now(),
        title: 'New Chapter',
        summary: '',
        start_date: '',
      }
      state.modifiedTime = Date.now()
      addItemToStructure(state.structure, action.payload.arcId, {
        id: newId,
        name: 'New Chapter',
        type: 'chapter',
        isOpen: false,
        children: [],
      })
    },
    createBook: (state) => {
      const newId = short.generate().toString()
      state.book[newId] = {
        id: newId,
        title: 'New Book',
        modifiedAt: Date.now(),
        summary: '',
        start_date: '',
      }
      state.modifiedTime = Date.now()
      addItemToStructure(state.structure, undefined, {
        id: newId,
        name: 'New Book',
        type: 'book',
        isOpen: false,
        children: [],
      })
    },
    createArc: (state, action: PayloadAction<{ bookId: string }>) => {
      const newId = short.generate().toString()
      state.arc[newId] = {
        id: newId,
        title: 'New Arc',
        modifiedAt: Date.now(),
        summary: '',
        start_date: '',
      }
      state.modifiedTime = Date.now()
      addItemToStructure(state.structure, action.payload.bookId, {
        id: newId,
        name: 'New Arc',
        type: 'arc',
        isOpen: false,
        children: [],
      })
    },
    createScene: (state, action: PayloadAction<{ chapterId: string }>) => {
      const newId = short.generate().toString()

      state.scene[newId] = {
        id: newId,
        title: 'New Scene',
        summary: '',
        modifiedAt: Date.now(),
        words: 0,
        hasAI: false,
        posted: false,
        plot_point_actions: [],
        cursor: 0,
        paragraphs: [],
        text: '',
      }
      state.modifiedTime = Date.now()
      addItemToStructure(state.structure, action.payload.chapterId, {
        id: newId,
        name: 'New Scene',
        type: 'scene',
        isOpen: false,
      })
    },
    deleteBook: (state, action: PayloadAction<{ bookId: string }>) => {
      // check if contains arcs
      const treeObject = findNodeInStructure(state.structure, action.payload.bookId)
      console.log(treeObject)
      if (treeObject && (treeObject.children === undefined || treeObject.children.length === 0)) {
        delete state.book[action.payload.bookId]
        state.modifiedTime = Date.now()
        removeItemFromStructure(state.structure, action.payload.bookId)
      } else {
        alert(`Remove children ${treeObject?.children?.length} first`)
      }
    },
    deleteChapter: (state, action: PayloadAction<{ chapterId: string }>) => {
      // check if contains scenes
      const treeObject = findNodeInStructure(state.structure, action.payload.chapterId)
      if (treeObject && (treeObject.children === undefined || treeObject.children.length === 0)) {
        delete state.chapter[action.payload.chapterId]
        state.modifiedTime = Date.now()
        removeItemFromStructure(state.structure, action.payload.chapterId)
      } else {
        alert(`Remove children ${treeObject?.children?.length} first`)
      }
    },
    deleteScene: (state, action: PayloadAction<{ sceneId: string }>) => {
      delete state.scene[action.payload.sceneId]
      state.modifiedTime = Date.now()
      removeItemFromStructure(state.structure, action.payload.sceneId)
    },
    createSceneParagraph: (
      state,
      action: PayloadAction<{
        sceneId: string
        afterParagraphId?: string
        state?: SceneParagraph['state']
        text?: string
      }>,
    ) => {
      const newId = short.generate().toString()
      const afterParagraphIndex = state.scene[action.payload.sceneId].paragraphs.findIndex((p) => {
        return p.id === action.payload.afterParagraphId
      })

      const currentScene = state.scene[action.payload.sceneId]
      currentScene.modifiedAt = Date.now()
      const afterParagraph = afterParagraphIndex >= 0 ? currentScene.paragraphs[afterParagraphIndex] : undefined
      const cursorPosition = currentScene.cursor

      const newParagraphText = action.payload.text
        ? action.payload.text
        : afterParagraph
          ? afterParagraph.text.substring(cursorPosition ?? 0)
          : ''
      if (afterParagraph && !action.payload.text) {
        afterParagraph.text = afterParagraph.text.substring(0, cursorPosition)
      }

      state.modifiedTime = Date.now()

      const paragraphData: SceneParagraph = {
        id: newId,
        text: newParagraphText,
        state: action.payload.state ?? 'draft',
        modifiedAt: Date.now(),
        comments: [],
        plot_point_actions: [],
      }

      if (afterParagraphIndex > -1) {
        console.log('adding after paragraph', afterParagraphIndex)
        state.scene[action.payload.sceneId].paragraphs.splice(afterParagraphIndex + 1, 0, paragraphData)
      } else {
        console.log('adding on end')
        state.scene[action.payload.sceneId].paragraphs.push(paragraphData)
      }
      // set selected paragraph to new one
      state.scene[action.payload.sceneId].selectedParagraph = newId
      state.scene[action.payload.sceneId].cursor = 0
    },
    moveItem: (state, action: PayloadAction<{ id: string; parentId: string; index: number }>) => {
      const item = removeItemFromStructure(state.structure, action.payload.id)
      if (item) {
        addItemToStructure(state.structure, action.payload.parentId, item, action.payload.index)
      }
      state.modifiedTime = Date.now()
    },
    moveSceneParagraph(
      state,
      action: PayloadAction<{
        sceneId: string
        paragraphId: string
        direction?: 'up' | 'down'
      }>,
    ) {
      const scene = state.scene[action.payload.sceneId]
      scene.modifiedAt = Date.now()
      const paragraphIndex = scene.paragraphs.findIndex((p) => {
        return p.id === action.payload.paragraphId
      })
      const paragraph = scene.paragraphs[paragraphIndex]
      if (action.payload.direction === 'up' && paragraphIndex > 0) {
        scene.paragraphs[paragraphIndex] = scene.paragraphs[paragraphIndex - 1]
        scene.paragraphs[paragraphIndex - 1] = paragraph
      } else if (action.payload.direction === 'down' && paragraphIndex < scene.paragraphs.length - 1) {
        scene.paragraphs[paragraphIndex] = scene.paragraphs[paragraphIndex + 1]
        scene.paragraphs[paragraphIndex + 1] = paragraph
      }
    },
    deleteSceneParagraph: (state, action: PayloadAction<{ sceneId: string; paragraphId: string }>) => {
      const paragraphIndex = state.scene[action.payload.sceneId].paragraphs.findIndex((p) => {
        return p.id === action.payload.paragraphId
      })
      removeEntityFromEmbeddingsCache(`paragraph/${action.payload.paragraphId}`)
      if (state.scene[action.payload.sceneId].paragraphs[paragraphIndex].text !== '' && paragraphIndex > 0) {
        const deletableParagraph = state.scene[action.payload.sceneId].paragraphs[paragraphIndex]
        const previousParagraph = state.scene[action.payload.sceneId].paragraphs[paragraphIndex - 1]
        state.scene[action.payload.sceneId].selectedParagraph = previousParagraph.id
        state.scene[action.payload.sceneId].cursor = previousParagraph.text.length + 0
        console.log('setting cursor', previousParagraph.text.length + 0)
        previousParagraph.text = `${previousParagraph.text}${
          previousParagraph.text.endsWith(' ') ? '' : ' '
        }${deletableParagraph.text}`
        console.log('lenght after', previousParagraph.text.length)
      }
      state.scene[action.payload.sceneId].modifiedAt = Date.now()
      state.scene[action.payload.sceneId].paragraphs.splice(paragraphIndex, 1)

      state.modifiedTime = Date.now()
    },
    updateSceneParagraph: (
      state,
      action: PayloadAction<{
        sceneId: string
        paragraphId: string
        text?: string
        translation?: string
        extraLoading?: boolean
        state?: SceneParagraph['state']
        extra?: string
      }>,
    ) => {
      const scene = state.scene[action.payload.sceneId]
      if (scene) {
        const paragraph = scene.paragraphs?.find((p) => {
          return p.id === action.payload.paragraphId
        })
        // if (action.payload.state === "ai") {
        //   scene.hasAI = true;
        // } else {
        //   scene.hasAI = scene.paragraphs.some((p) => p.state === "ai");
        // }

        if (paragraph) {
          // scene.posted = false;
          // scene.modifiedAt = Date.now();
          // scene.words = scene.paragraphs.reduce((acc, p) => {
          //   return acc + p.text.split(" ").length;
          // }, 0);

          if (action.payload.text !== undefined) {
            paragraph.text = action.payload.text
            // removeEntityFromEmbeddingsCache(
            //   `paragraph/${action.payload.paragraphId}`,
            // );
          }
          if (action.payload.translation !== undefined) {
            paragraph.translation = action.payload.translation
          }
          if (action.payload.extraLoading !== undefined) {
            paragraph.extraLoading = action.payload.extraLoading
          }
          if (action.payload.state) {
            paragraph.state = action.payload.state
          } else if (action.payload.text && ['revise', 'ai'].includes(paragraph.state)) {
            paragraph.state = 'draft'
          }
          if (action.payload.extra !== undefined) {
            console.log('setting extra')
            paragraph.extra = action.payload.extra
          }
          paragraph.modifiedAt = Date.now()
          // state.modifiedTime = Date.now();
        }
      }
    },
    splitSceneFromParagraph: (
      state,
      action: PayloadAction<{
        sceneId: string
        paragraphId: string
      }>,
    ) => {
      const scene = state.scene[action.payload.sceneId]
      const paragraph = scene.paragraphs.find((p) => {
        return p.id === action.payload.paragraphId
      })
      const chapterId = findParentIdForNode(state.structure, scene.id, undefined)

      if (paragraph && chapterId) {
        state.modifiedTime = Date.now()
        // get all paragraphs after the current one
        const paragraphs = scene.paragraphs.splice(scene.paragraphs.indexOf(paragraph))
        for (const p of paragraphs) {
          removeEntityFromEmbeddingsCache(`paragraph/${p.id}`)
        }
        scene.modifiedAt = Date.now()
        // create new scene
        const newSceneId = short.generate().toString()
        state.scene[newSceneId] = {
          id: newSceneId,
          title: 'New Scene',
          summary: '',
          words: paragraphs.reduce((acc, p) => {
            return acc + p.text.split(' ').length
          }, 0),
          // do new paragraphs have AI
          hasAI: paragraphs.some((p) => p.state === 'ai'),
          modifiedAt: Date.now(),
          posted: false,
          plot_point_actions: [],
          cursor: 0,
          paragraphs,
          text: '',
        }
        // add new scene to structure
        addItemToStructure(state.structure, chapterId, {
          id: newSceneId,
          name: 'New Scene',
          type: 'scene',
          isOpen: false,
        })
      }
    },
    updateScene: (state, action: PayloadAction<Partial<Scene>>) => {
      const id = action.payload.id as keyof typeof state.scene
      if (id) {
        const obj = state.scene[id]
        const keys = Object.keys(action.payload)
        for (const key of keys) {
          const writableKey = key as keyof Scene
          if (obj[writableKey] !== action.payload[writableKey]) {
            // @ts-ignore
            obj[writableKey] = action.payload[writableKey]
            if (writableKey === 'title') {
              updateItemInStructure(state.structure, id, {
                name: action.payload.title,
              })
            }
          }
        }
        obj.modifiedAt = Date.now()
        // update title in structure
        state.modifiedTime = Date.now()
      }
    },
    updateChapter: (state, action: PayloadAction<Partial<Chapter>>) => {
      if (action.payload.id) {
        console.log(action.payload)
        state.chapter[action.payload.id].modifiedAt = Date.now()
        for (const key in action.payload) {
          state.chapter[action.payload.id][key as keyof Chapter] = action.payload[key as keyof Chapter]
        }
        // update title in structure
        if (action.payload.title) {
          updateItemInStructure(state.structure, action.payload.id, {
            name: action.payload.title,
          })
        }
        state.modifiedTime = Date.now()
      }
    },
    updateArc: (state, action: PayloadAction<Partial<Arc>>) => {
      if (action.payload.id) {
        state.arc[action.payload.id] = {
          ...state.arc[action.payload.id],
          ...action.payload,
          modifiedAt: Date.now(),
        }
        // update title in structure
        updateItemInStructure(state.structure, action.payload.id, {
          name: action.payload.title,
        })
        state.modifiedTime = Date.now()
      }
    },
    updateBook: (state, action: PayloadAction<Partial<Book>>) => {
      if (action.payload.id) {
        state.book[action.payload.id] = {
          ...state.book[action.payload.id],
          ...action.payload,
          modifiedAt: Date.now(),
        }
        // update title in structure
        updateItemInStructure(state.structure, action.payload.id, {
          name: action.payload.title,
        })
        state.modifiedTime = Date.now()
      }
    },
    createCharacter: (state, _action: PayloadAction<{}>) => {
      const newId = short.generate().toString()
      state.characters[newId] = {
        id: newId,
        name: 'New character',
        modifiedAt: Date.now(),
        summary: '',
        picture: '',
        age: '',
        isProtagonist: false,
      }
      state.modifiedTime = Date.now()
    },
    updateCharacter: (state, action: PayloadAction<Partial<Character>>) => {
      if (action.payload.id) {
        state.characters[action.payload.id] = {
          ...state.characters[action.payload.id],
          ...action.payload,
          modifiedAt: Date.now(),
        }
        removeEntityFromEmbeddingsCache(`character/${action.payload.id}`)
        state.modifiedTime = Date.now()
      }
    },
    removeCharacter: (state, action: PayloadAction<string>) => {
      delete state.characters[action.payload]
      state.modifiedTime = Date.now()
    },
    deletePlotPoint: (
      state,
      action: PayloadAction<{
        plotpointId: string
      }>,
    ) => {
      delete state.plotPoints[action.payload.plotpointId]
      state.modifiedTime = Date.now()
    },
    createPlotPoint: (state, _action: PayloadAction<{}>) => {
      const newId = short.generate().toString()
      state.plotPoints[newId] = {
        id: newId,
        modifiedAt: Date.now(),
        summary: '',
        title: '',
      }
      state.modifiedTime = Date.now()
    },
    updatePlotpoint: (
      state,
      action: PayloadAction<{
        id: string
        title?: string
        summary?: string
      }>,
    ) => {
      state.plotPoints[action.payload.id] = {
        ...state.plotPoints[action.payload.id],
        ...action.payload,
        modifiedAt: Date.now(),
      }
      state.modifiedTime = Date.now()
    },
    addInventoryActionToSceneParagraph: (
      state,
      action: PayloadAction<
        {
          sceneId: string
          paragraphId: string
        } & InventoryAction
      >,
    ) => {
      const scene = state.scene[action.payload.sceneId]

      if (!scene) return

      const p = scene.paragraphs.find((p) => {
        return p.id === action.payload.paragraphId
      })

      if (!p) return

      scene.modifiedAt = Date.now()
      p.modifiedAt = Date.now()
      if (!p.inventory_actions) p.inventory_actions = []
      p.inventory_actions.push({
        type: action.payload.type,
        item_name: action.payload.item_name,
        item_amount: action.payload.item_amount,
      })
      // find existing item
      const item = Object.values(state.item ?? {}).find((i) => i.name === action.payload.item_name)
      if (!item) {
        // create new item
        const newId = short.generate().toString()
        if (!state.item) state.item = {}
        state.item[newId] = {
          id: newId,
          name: action.payload.item_name,
          modifiedAt: Date.now(),
        }
      }

      state.modifiedTime = Date.now()
    },
    removeInventoryActionFromSceneParagraph: (
      state,
      action: PayloadAction<{
        sceneId: string
        paragraphId: string
        item_name: string
        item_amount: number
      }>,
    ) => {
      const scene = state.scene[action.payload.sceneId]

      if (!scene) return

      const p = scene.paragraphs.find((p) => {
        return p.id === action.payload.paragraphId
      })

      if (!p) return

      scene.modifiedAt = Date.now()
      p.modifiedAt = Date.now()
      if (!p.inventory_actions) return
      p.inventory_actions = p.inventory_actions.filter((i) => {
        return i.item_name !== action.payload.item_name && i.item_amount !== action.payload.item_amount
      })
      state.modifiedTime = Date.now()
    },

    addPlotPointToSceneParagraph: (
      state,
      action: PayloadAction<{
        sceneId: string
        paragraphId: string
        plotpointId: string
        action: string
      }>,
    ) => {
      const scene = state.scene[action.payload.sceneId]

      if (!scene) return

      const p = scene.paragraphs.find((p) => {
        return p.id === action.payload.paragraphId
      })

      if (
        p &&
        !p.plot_point_actions.some((i) => {
          return i.plot_point_id === action.payload.plotpointId
        })
      ) {
        scene.modifiedAt = Date.now()
        p.modifiedAt = Date.now()
        p.plot_point_actions.push({
          plot_point_id: action.payload.plotpointId,
          action: action.payload.action,
        })
        state.modifiedTime = Date.now()
      }
    },
    addPlotPointToScene: (
      state,
      action: PayloadAction<{
        sceneId: string
        plotpointId: string
        action: string
      }>,
    ) => {
      const scene = state.scene[action.payload.sceneId]
      if (!scene) return
      scene.modifiedAt = Date.now()
      state.scene[action.payload.sceneId].plot_point_actions.push({
        plot_point_id: action.payload.plotpointId,
        action: action.payload.action,
      })
      state.modifiedTime = Date.now()
    },
    removePlotPointFromSceneParagraph: (
      state,
      action: PayloadAction<{
        sceneId: string
        paragraphId: string
        plotpointId: string
        action: string
      }>,
    ) => {
      const scene = state.scene[action.payload.sceneId]
      if (!scene) return

      const p = scene.paragraphs.find((p) => {
        return p.id === action.payload.paragraphId
      })
      if (p) {
        scene.modifiedAt = Date.now()
        p.modifiedAt = Date.now()
        p.plot_point_actions = p?.plot_point_actions.filter((i) => {
          return i.plot_point_id !== action.payload.plotpointId && i.action !== action.payload.action
        })
        state.modifiedTime = Date.now()
      }
    },
    removePlotPointFromScene: (
      state,
      action: PayloadAction<{
        sceneId: string
        plotpointId: string
        action: string
      }>,
    ) => {
      const scene = state.scene[action.payload.sceneId]
      if (!scene) return
      scene.plot_point_actions = state.scene[action.payload.sceneId].plot_point_actions.filter((i) => {
        return i.plot_point_id !== action.payload.plotpointId && i.action !== action.payload.action
      })
      state.modifiedTime = Date.now()
    },
    updatePublishTime: (state, action: PayloadAction<number>) => {
      state.lastPublishTime = action.payload
    },
    putUploadedFile: (
      state,
      action: PayloadAction<{
        path: string
        hash: string
        publicUrl: string
      }>,
    ) => {
      if (!state.uploadedFiles) {
        state.uploadedFiles = {}
      }
      state.uploadedFiles[action.payload.path] = {
        hash: action.payload.hash,
        publicUrl: action.payload.publicUrl,
      }
    },
    setName: (state, action: PayloadAction<string>) => {
      state.name = action.payload
    },
  },
})

// Action creators are generated for each case reducer function
export const storyActions = globalSlice.actions

export const reducer = globalSlice.reducer
