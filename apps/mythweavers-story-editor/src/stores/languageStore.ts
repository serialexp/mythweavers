import { createStore } from 'solid-js/store'

export interface StoryLanguage {
  id: string
  name: string // Used in LLM prompts, e.g. "Scottish Gaelic"
  label: string // Display in UI, e.g. "Gaelic"
  isDefault: boolean
}

interface LanguageState {
  languages: StoryLanguage[]
  defaultLanguageId: string | null
}

const [languageState, setLanguageState] = createStore<LanguageState>({
  languages: [],
  defaultLanguageId: null,
})

export const languageStore = {
  get languages() {
    return languageState.languages
  },

  get defaultLanguageId() {
    return languageState.defaultLanguageId
  },

  get primaryLanguage(): StoryLanguage | null {
    return languageState.languages.find((l) => l.id === languageState.defaultLanguageId) ?? null
  },

  get nonPrimaryLanguages(): StoryLanguage[] {
    return languageState.languages.filter((l) => l.id !== languageState.defaultLanguageId)
  },

  loadFromExport(languages: Array<{ id: string; name: string; label: string; isDefault: boolean }>): void {
    const defaultLang = languages.find((l) => l.isDefault)
    setLanguageState({
      languages: languages.map((l) => ({
        id: l.id,
        name: l.name,
        label: l.label,
        isDefault: l.isDefault,
      })),
      defaultLanguageId: defaultLang?.id ?? null,
    })
  },

  setLanguages(languages: StoryLanguage[], defaultLanguageId: string | null): void {
    setLanguageState({
      languages,
      defaultLanguageId,
    })
  },

  setDefaultLanguageId(id: string | null): void {
    setLanguageState('defaultLanguageId', id)
    // Update isDefault flags
    setLanguageState(
      'languages',
      languageState.languages.map((l) => ({
        ...l,
        isDefault: l.id === id,
      })),
    )
  },

  addLanguage(language: StoryLanguage): void {
    setLanguageState('languages', [...languageState.languages, language])
    if (language.isDefault) {
      setLanguageState('defaultLanguageId', language.id)
    }
  },

  updateLanguage(id: string, updates: Partial<Pick<StoryLanguage, 'name' | 'label'>>): void {
    setLanguageState(
      'languages',
      languageState.languages.map((l) => (l.id === id ? { ...l, ...updates } : l)),
    )
  },

  removeLanguage(id: string): void {
    setLanguageState(
      'languages',
      languageState.languages.filter((l) => l.id !== id),
    )
  },

  clear(): void {
    setLanguageState({
      languages: [],
      defaultLanguageId: null,
    })
  },
}
