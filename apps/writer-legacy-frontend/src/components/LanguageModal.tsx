import { Modal, ModalBody, ModalCloseButton, ModalContent, ModalHeader, ModalOverlay } from '@chakra-ui/react'
import React from 'react'
import { useSelector } from 'react-redux'
import { RootState } from '../lib/store'
import { LanguageForm } from './LanguageForm'

export const LanguageModal = (props: {
  languageId: string
  onClose: () => void
}) => {
  const { languageId } = props
  const [_newWord, _setNewWord] = React.useState('')

  const language = useSelector((state: RootState) => state.language.languages[languageId])

  return (
    <Modal isOpen={true} onClose={props.onClose} size={'full'}>
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>Language {language?.id}</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <LanguageForm languageId={languageId} />
        </ModalBody>
      </ModalContent>
    </Modal>
  )
}
