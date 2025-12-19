import { Box, Flex } from '@chakra-ui/react'
import axios from 'axios'
import { Fragment } from 'react'
import { useQuery } from 'react-query'
import { useDispatch, useSelector } from 'react-redux'
import { selectedImageChapterSelector } from '../lib/selectors/selectedImageChapter'
import { selectedImagePathSelector } from '../lib/selectors/selectedImagePath'
import { storySettingsSelector } from '../lib/selectors/storySettings'
import { globalActions } from '../lib/slices/global'
import { TreeNode } from '../lib/types'
import { getSection } from '../lib/util'

export const NavTree = () => {
  const storySettings = useSelector(storySettingsSelector)
  const { data, isFetched } = useQuery<TreeNode>('tree', () => {
    return axios
      .post('/api/tree', {
        path: storySettings?.mangaChapterPath,
      })
      .then((res) => res.data)
  })
  const selectedImageChapter = useSelector(selectedImageChapterSelector)
  const selectedImagePath = useSelector(selectedImagePathSelector)

  const dispatch = useDispatch()

  return isFetched ? (
    <Flex flexDirection={'column'} overflow={'auto'} maxHeight={'100%'}>
      {data?.children?.map((chapter) => {
        return (
          <Fragment key={chapter.name}>
            <Box
              px={2}
              py={1}
              cursor={'pointer'}
              bg={'green.300'}
              _hover={{ bg: 'green.600' }}
              onClick={() => dispatch(globalActions.setSelectedImageChapter(chapter.name))}
            >
              {chapter.name}
            </Box>

            {chapter.name === selectedImageChapter ? (
              <Box pl={2}>
                {chapter.children?.map((page) => {
                  const { pageNr, chapter } = getSection(page.path)
                  return (
                    <Box
                      key={page.path}
                      px={2}
                      py={1}
                      cursor={'pointer'}
                      bg={selectedImagePath === page.path ? 'green.500' : 'green.400'}
                      _hover={{ bg: 'green.600' }}
                      onClick={() => {
                        dispatch(globalActions.setImagePath(page.path))
                      }}
                    >
                      {page.name}
                    </Box>
                  )
                })}
              </Box>
            ) : null}
          </Fragment>
        )
      })}
    </Flex>
  ) : null
}
