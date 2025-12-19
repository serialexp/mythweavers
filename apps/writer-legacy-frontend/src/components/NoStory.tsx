import { Box, Button, Flex } from '@chakra-ui/react'

export const NoStory = () => {
  return (
    <Flex width={'80'} direction={'column'} margin={'4em auto'}>
      <Box p={2}>No story loaded.</Box>
      <br />
      <Button
        colorScheme={'blue'}
        onClick={() => {
          window.location.href = '/'
        }}
      >
        Load a story
      </Button>
    </Flex>
  )
}
