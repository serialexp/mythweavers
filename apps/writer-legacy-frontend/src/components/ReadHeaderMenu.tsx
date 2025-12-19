import { Flex, useColorModeValue } from '@chakra-ui/react'
import { useRouter } from 'wouter'

export const ReadHeaderMenu = () => {
  const _router = useRouter()
  const color = useColorModeValue('blue.300', 'gray.700')

  return (
    <Flex bg={color} justifyContent={'space-between'}>
      <Flex px={2} py={1} gap={1} />
      <Flex px={2} gap={1} py={1} justifyContent={'flex-end'} />
    </Flex>
  )
}
