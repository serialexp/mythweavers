import { Box } from '@chakra-ui/react'
import type { PropsWithChildren } from 'react'
import { ReadHeaderMenu } from './ReadHeaderMenu'

export const Layout = (props: PropsWithChildren) => {
  return (
    <Box>
      <ReadHeaderMenu />
      {props.children}
    </Box>
  )
}
