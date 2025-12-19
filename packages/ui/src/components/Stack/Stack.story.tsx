import { ThemeComparison } from '../../story-utils/ThemeComparison'
import { HStack, Stack, VStack } from './Stack'

const Box = (props: { children?: string; style?: any }) => (
  <div
    style={{
      padding: '1rem',
      'background-color': 'var(--color-surface-default)',
      border: '1px solid var(--color-border-default)',
      'border-radius': '4px',
      ...props.style,
    }}
  >
    {props.children ?? 'Item'}
  </div>
)

export default (props: { Hst: any }) => {
  const { Hst } = props

  return (
    <Hst.Story title="Stack" group="layout">
      <Hst.Variant title="Vertical (default)">
        <ThemeComparison>
          <Stack>
            <Box>Item 1</Box>
            <Box>Item 2</Box>
            <Box>Item 3</Box>
          </Stack>
        </ThemeComparison>
      </Hst.Variant>

      <Hst.Variant title="Horizontal">
        <ThemeComparison>
          <Stack direction="horizontal">
            <Box>Item 1</Box>
            <Box>Item 2</Box>
            <Box>Item 3</Box>
          </Stack>
        </ThemeComparison>
      </Hst.Variant>

      <Hst.Variant title="HStack & VStack Shortcuts">
        <ThemeComparison>
          <VStack gap="lg">
            <HStack gap="md">
              <Box>H1</Box>
              <Box>H2</Box>
              <Box>H3</Box>
            </HStack>
            <HStack gap="md">
              <Box>H4</Box>
              <Box>H5</Box>
              <Box>H6</Box>
            </HStack>
          </VStack>
        </ThemeComparison>
      </Hst.Variant>

      <Hst.Variant title="Gap Sizes">
        <ThemeComparison>
          <VStack gap="lg">
            <div>
              <small>gap="xs"</small>
              <HStack gap="xs">
                <Box>1</Box>
                <Box>2</Box>
                <Box>3</Box>
              </HStack>
            </div>
            <div>
              <small>gap="sm"</small>
              <HStack gap="sm">
                <Box>1</Box>
                <Box>2</Box>
                <Box>3</Box>
              </HStack>
            </div>
            <div>
              <small>gap="md"</small>
              <HStack gap="md">
                <Box>1</Box>
                <Box>2</Box>
                <Box>3</Box>
              </HStack>
            </div>
            <div>
              <small>gap="lg"</small>
              <HStack gap="lg">
                <Box>1</Box>
                <Box>2</Box>
                <Box>3</Box>
              </HStack>
            </div>
            <div>
              <small>gap="xl"</small>
              <HStack gap="xl">
                <Box>1</Box>
                <Box>2</Box>
                <Box>3</Box>
              </HStack>
            </div>
          </VStack>
        </ThemeComparison>
      </Hst.Variant>

      <Hst.Variant title="Alignment">
        <ThemeComparison>
          <VStack gap="lg">
            <div>
              <small>align="start"</small>
              <HStack align="start" style={{ height: '80px', background: 'var(--color-bg-raised)' }}>
                <Box style={{ height: '40px' }}>Short</Box>
                <Box style={{ height: '60px' }}>Tall</Box>
                <Box style={{ height: '30px' }}>Tiny</Box>
              </HStack>
            </div>
            <div>
              <small>align="center"</small>
              <HStack align="center" style={{ height: '80px', background: 'var(--color-bg-raised)' }}>
                <Box style={{ height: '40px' }}>Short</Box>
                <Box style={{ height: '60px' }}>Tall</Box>
                <Box style={{ height: '30px' }}>Tiny</Box>
              </HStack>
            </div>
            <div>
              <small>align="end"</small>
              <HStack align="end" style={{ height: '80px', background: 'var(--color-bg-raised)' }}>
                <Box style={{ height: '40px' }}>Short</Box>
                <Box style={{ height: '60px' }}>Tall</Box>
                <Box style={{ height: '30px' }}>Tiny</Box>
              </HStack>
            </div>
          </VStack>
        </ThemeComparison>
      </Hst.Variant>

      <Hst.Variant title="Justify">
        <ThemeComparison>
          <VStack gap="lg">
            <div>
              <small>justify="start"</small>
              <HStack justify="start" style={{ background: 'var(--color-bg-raised)' }}>
                <Box>1</Box>
                <Box>2</Box>
              </HStack>
            </div>
            <div>
              <small>justify="center"</small>
              <HStack justify="center" style={{ background: 'var(--color-bg-raised)' }}>
                <Box>1</Box>
                <Box>2</Box>
              </HStack>
            </div>
            <div>
              <small>justify="end"</small>
              <HStack justify="end" style={{ background: 'var(--color-bg-raised)' }}>
                <Box>1</Box>
                <Box>2</Box>
              </HStack>
            </div>
            <div>
              <small>justify="between"</small>
              <HStack justify="between" style={{ background: 'var(--color-bg-raised)' }}>
                <Box>1</Box>
                <Box>2</Box>
              </HStack>
            </div>
          </VStack>
        </ThemeComparison>
      </Hst.Variant>

      <Hst.Variant title="Wrap">
        <ThemeComparison>
          <HStack wrap gap="sm" style={{ width: '300px' }}>
            <Box>Item 1</Box>
            <Box>Item 2</Box>
            <Box>Item 3</Box>
            <Box>Item 4</Box>
            <Box>Item 5</Box>
            <Box>Item 6</Box>
          </HStack>
        </ThemeComparison>
      </Hst.Variant>
    </Hst.Story>
  )
}
