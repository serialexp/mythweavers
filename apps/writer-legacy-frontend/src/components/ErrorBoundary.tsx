import { Box, Flex } from '@chakra-ui/react'
import React from 'react'

export class ErrorBoundary extends React.Component<
  React.PropsWithChildren<{ fallback?: React.ReactElement }>,
  { hasError: boolean; error?: Error }
> {
  constructor(props: React.PropsWithChildren<{ fallback?: React.ReactElement }>) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error) {
    // Update state so the next render will show the fallback UI.
    console.log('dreved error', error)
    return { hasError: true, error: error }
  }

  componentDidCatch(error: Error, info: unknown) {
    console.error(error, info)
  }

  render() {
    if (this.state.hasError) {
      // You can render any custom fallback UI
      return (
        this.props.fallback ?? (
          <Flex flexDir="column">
            <Box p={2}>Something went wrong.</Box>
            <Box p={2} m={2} bg="gray.200">
              {this.state.error?.toString()}
              <br />
              <pre>{this.state.error?.stack}</pre>
            </Box>
          </Flex>
        )
      )
    }

    return this.props.children
  }
}
