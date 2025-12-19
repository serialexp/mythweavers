import { PayloadAction, createSlice } from '@reduxjs/toolkit'
import short from 'short-uuid'

export const languageSlice = createSlice({
  name: 'language',
  initialState,
  reducers: {
    setLanguages: (_state, action: PayloadAction<LanguageState>) => {
      return action.payload
    },
    addLanguage: (state, action: PayloadAction<Partial<Language>>) => {
      const id = short.generate()
      state.languages[id] = {
        id,
        summary: '',
        title: '',
        phonemes: [],
        wordOptions: [],
        vocabulary: [],
        pronouns: [],
        ...action.payload,
      }
    },
    updateLanguage: (state, action: PayloadAction<Partial<Language> & { id: string }>) => {
      state.languages[action.payload.id] = {
        ...state.languages[action.payload.id],
        ...action.payload,
      }
    },
    addWord: (state, action: PayloadAction<{ languageId: string }>) => {
      state.languages[action.payload.languageId].vocabulary.push({
        id: short.generate(),
        native: 'native',
        meaning: 'meaning',
      })
    },
    updateWord: (
      state,
      action: PayloadAction<{
        languageId: string
        word: Partial<Word> & { id: string }
      }>,
    ) => {
      const language = state.languages[action.payload.languageId]
      const word = language.vocabulary.find((word) => word.id === action.payload.word.id)

      if (word) {
        if (action.payload.word.native !== undefined) {
          word.native = action.payload.word.native
        }
        if (action.payload.word.meaning !== undefined) {
          word.meaning = action.payload.word.meaning
        }
      }
    },
    deleteWord: (state, action: PayloadAction<{ languageId: string; wordId: string }>) => {
      const language = state.languages[action.payload.languageId]
      language.vocabulary = language.vocabulary.filter((word) => word.id !== action.payload.wordId)
    },
    addPronoun: (state, action: PayloadAction<{ languageId: string }>) => {
      state.languages[action.payload.languageId].pronouns.push({
        id: short.generate(),
        native: 'native',
        meaning: 'meaning',
      })
    },
    updatePronoun: (
      state,
      action: PayloadAction<{
        languageId: string
        word: Partial<Word> & { id: string }
      }>,
    ) => {
      const language = state.languages[action.payload.languageId]
      const word = language.pronouns.find((word) => word.id === action.payload.word.id)

      if (word) {
        if (action.payload.word.native !== undefined) {
          word.native = action.payload.word.native
        }
        if (action.payload.word.meaning !== undefined) {
          word.meaning = action.payload.word.meaning
        }
      }
    },
    deletePronoun: (state, action: PayloadAction<{ languageId: string; wordId: string }>) => {
      const language = state.languages[action.payload.languageId]
      language.pronouns = language.pronouns.filter((word) => word.id !== action.payload.wordId)
    },
    addPhoneme: (state, action: PayloadAction<{ languageId: string }>) => {
      state.languages[action.payload.languageId].phonemes.push({
        id: short.generate(),
        identifier: state.languages[action.payload.languageId].phonemes.length.toString(16),
        options: 'a a',
      })
    },
    updatePhoneme: (
      state,
      action: PayloadAction<{
        languageId: string
        phonemeId: string
        values: Partial<Phoneme>
      }>,
    ) => {
      const phoneme = state.languages[action.payload.languageId].phonemes.find(
        (phoneme) => phoneme.id === action.payload.phonemeId,
      )
      if (phoneme) {
        if (action.payload.values.identifier !== undefined) {
          phoneme.identifier = action.payload.values.identifier
        }
        if (action.payload.values.options !== undefined) {
          phoneme.options = action.payload.values.options
        }
      }
    },
    addWordOption: (state, action: PayloadAction<{ languageId: string }>) => {
      state.languages[action.payload.languageId].wordOptions.push({
        id: short.generate(),
        identifier: state.languages[action.payload.languageId].wordOptions.length.toString(16),
        option: '{A}{A?}}',
      })
    },
    updateWordOption: (
      state,
      action: PayloadAction<{
        languageId: string
        wordoptionId: string
        values: Partial<WordOption>
      }>,
    ) => {
      const option = state.languages[action.payload.languageId].wordOptions.find(
        (phoneme) => phoneme.id === action.payload.wordoptionId,
      )
      if (option) {
        if (action.payload.values.identifier !== undefined) {
          option.identifier = action.payload.values.identifier
        }
        if (action.payload.values.option !== undefined) {
          option.option = action.payload.values.option
        }
      }
    },
  },
})

// Action creators are generated for each case reducer function
export const languageActions = languageSlice.actions

export const reducer = languageSlice.reducer
