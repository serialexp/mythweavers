import { Button } from '@chakra-ui/react'
import { useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { languageActions } from '../lib/slices/language'
import type { RootState } from '../lib/store'
import { LanguageModal } from './LanguageModal'

export const LanguagePanel = () => {
  const dispatch = useDispatch()
  const [langModal, setLanguageModal] = useState<boolean>(false)
  const [languageId, setLanguageId] = useState<string>('')

  const languages = useSelector((state: RootState) => state.language.languages)

  return (
    <>
      <table>
        {Object.values(languages).map((lang) => (
          <tr
            key={lang.id}
            onClick={() => {
              setLanguageModal(true)
              setLanguageId(lang.id)
            }}
          >
            <td>
              {lang.title}
              <span
                style={{ cursor: 'pointer' }}
                onClick={(e) => {
                  e.stopPropagation()
                  e.preventDefault()
                }}
              >
                X
              </span>
              ]
            </td>
          </tr>
        ))}
      </table>
      <Button
        onClick={() => {
          dispatch(
            languageActions.addLanguage({
              title: 'New language',
            }),
          )
        }}
      >
        Add language
      </Button>
      {langModal && (
        <LanguageModal
          languageId={languageId}
          onClose={() => {
            setLanguageModal(false)
          }}
        />
      )}
    </>
  )
}
