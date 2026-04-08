import { Alert, Container, Heading, Stack, Text } from "@mythweavers/ui"

export function NotAdminPage() {
  return (
    <Container size="sm" padding="lg" center>
      <Stack direction="vertical" gap="lg" align="center">
        <Heading level={1} size="2xl">
          Access Denied
        </Heading>
        <Alert variant="error" title="Admin access required">
          <Text>
            Your account does not have admin privileges. Please contact an
            administrator if you believe this is an error.
          </Text>
        </Alert>
      </Stack>
    </Container>
  )
}
