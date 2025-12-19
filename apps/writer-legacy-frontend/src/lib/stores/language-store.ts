import { Language } from '@writer/shared'
import { createStore } from 'solid-js/store'

const languageStoreDefault = {
  languages: {
    languages: {},
  },
}
export const [languageStore, setLanguageStore] = createStore<{
  languages: Language
}>(languageStoreDefault)

export const resetLanguageStore = () => {
  setLanguageStore({
    languages: {
      languages: {},
    },
  })
}
