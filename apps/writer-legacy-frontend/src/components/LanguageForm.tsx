import { Box, Button, Flex, FormControl, FormLabel, Input, Table, Textarea } from '@chakra-ui/react'
import React from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { languageActions } from '../lib/slices/language'
import { RootState } from '../lib/store'

export const LanguageForm = (props: {
  languageId: string
}) => {
  const { languageId } = props
  const dispatch = useDispatch()
  const [newWord, setNewWord] = React.useState('')

  const language = useSelector((state: RootState) => state.language.languages[languageId])

  return (
    <Flex direction={'column'}>
      <FormControl>
        <FormLabel>Name</FormLabel>
        <Input
          type={'text'}
          value={language?.title || undefined}
          onChange={(e) => {
            dispatch(
              languageActions.updateLanguage({
                id: languageId,
                title: e.currentTarget.value,
              }),
            )
          }}
        />
      </FormControl>
      <FormControl>
        <FormLabel>Summary</FormLabel>
        <Textarea
          value={language?.summary}
          onChange={(e) => {
            dispatch(
              languageActions.updateLanguage({
                id: languageId,
                summary: e.currentTarget.value,
              }),
            )
          }}
        />
      </FormControl>
      <h2>Phonemes</h2>
      <Table>
        {language.phonemes.map((phoneme) => {
          return (
            <tr key={phoneme.id}>
              <td>
                <Input
                  type={'text'}
                  value={phoneme.identifier}
                  onChange={(e) => {
                    dispatch(
                      languageActions.updatePhoneme({
                        languageId,
                        phonemeId: phoneme.id,
                        values: {
                          identifier: e.currentTarget.value,
                        },
                      }),
                    )
                  }}
                />
              </td>
              <td>
                <Input
                  type={'text'}
                  value={phoneme.options}
                  onChange={(e) => {
                    dispatch(
                      languageActions.updatePhoneme({
                        languageId,
                        phonemeId: phoneme.id,
                        values: {
                          options: e.currentTarget.value,
                        },
                      }),
                    )
                  }}
                />
              </td>
            </tr>
          )
        })}
      </Table>
      <Button
        onClick={() => {
          dispatch(
            languageActions.addPhoneme({
              languageId,
            }),
          )
        }}
      >
        New phoneme
      </Button>
      <h2>Word options</h2>
      <Table>
        {language?.wordOptions.map((option) => (
          <tr key={option.id}>
            <td>
              <Input
                type={'text'}
                value={option.identifier}
                onChange={(e) => {
                  dispatch(
                    languageActions.updateWordOption({
                      languageId,
                      wordoptionId: option.id,
                      values: {
                        identifier: e.currentTarget.value,
                      },
                    }),
                  )
                }}
              />
            </td>
            <td>
              <Input
                type={'text'}
                value={option.option}
                onChange={(e) => {
                  dispatch(
                    languageActions.updateWordOption({
                      languageId,
                      wordoptionId: option.id,
                      values: {
                        option: e.currentTarget.value,
                      },
                    }),
                  )
                }}
              />
            </td>
          </tr>
        ))}
      </Table>
      <Button
        onClick={() => {
          dispatch(
            languageActions.addWordOption({
              languageId,
            }),
          )
        }}
      >
        New word option
      </Button>
      <Box>
        <Button
          onClick={() => {
            const assocPhonemes: Record<string, string[]> = {}
            language.phonemes.forEach((phoneme) => {
              assocPhonemes[phoneme.identifier] = phoneme.options.split(' ')
            })
            let newWorlds = ''
            for (let i = 0; i < 10; i++) {
              const randomWordOption = language.wordOptions[Math.floor(Math.random() * language.wordOptions.length)]
              const randomWord = randomWordOption.option.replace(/{([^}]+)}/g, (_match, p1) => {
                // skip if optional
                if (p1.endsWith('?') && Math.random() < 0.5) {
                  return ''
                }
                // take off optional
                if (p1.endsWith('?')) {
                  p1 = p1.slice(0, -1)
                }
                return assocPhonemes[p1][Math.floor(Math.random() * assocPhonemes[p1].length)]
              })
              newWorlds += `${randomWordOption.identifier}: ${randomWord}\n`
            }
            setNewWord(newWorlds)
          }}
        >
          Generate new word
        </Button>
        <Box m={2} p={2} bg={'gray.400'} color={'black'} whiteSpace={'pre'}>
          {newWord}
        </Box>
      </Box>
      <h2>Vocabulary</h2>
      <Table>
        {language?.vocabulary.map((word) => (
          <tr key={word.id}>
            <td>
              <input
                type={'text'}
                value={word.native}
                onChange={(e) => {
                  dispatch(
                    languageActions.updateWord({
                      languageId,
                      word: {
                        id: word.id,
                        native: e.currentTarget.value,
                      },
                    }),
                  )
                }}
              />
            </td>
            <td>
              <input
                type={'text'}
                value={word.meaning}
                onChange={(e) => {
                  dispatch(
                    languageActions.updateWord({
                      languageId,
                      word: {
                        id: word.id,
                        meaning: e.currentTarget.value,
                      },
                    }),
                  )
                }}
              />
            </td>
          </tr>
        ))}
      </Table>
      <Button
        onClick={() => {
          dispatch(
            languageActions.addWord({
              languageId,
            }),
          )
        }}
      >
        New word
      </Button>
      <h2>Pronouns</h2>
      <table>
        {language?.pronouns.map((word) => (
          <tr key={word.id}>
            <td>
              <input
                type={'text'}
                value={word.native}
                onChange={(e) => {
                  dispatch(
                    languageActions.updatePronoun({
                      languageId,
                      word: {
                        id: word.id,
                        native: e.currentTarget.value,
                      },
                    }),
                  )
                }}
              />
            </td>
            <td>
              <input
                type={'text'}
                value={word.meaning}
                onChange={(e) => {
                  dispatch(
                    languageActions.updatePronoun({
                      languageId,
                      word: {
                        id: word.id,
                        meaning: e.currentTarget.value,
                      },
                    }),
                  )
                }}
              />
            </td>
          </tr>
        ))}
      </table>
      <Button
        onClick={() => {
          dispatch(
            languageActions.addPronoun({
              languageId,
            }),
          )
        }}
      >
        New pronoun
      </Button>
    </Flex>
  )
}
