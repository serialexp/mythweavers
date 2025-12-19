import { ThemeComparison } from '../../story-utils/ThemeComparison'
import { Grid, GridItem } from './Grid'

const Box = (props: { children?: string; style?: any }) => (
  <div
    style={{
      padding: '1rem',
      'background-color': 'var(--color-surface-default)',
      border: '1px solid var(--color-border-default)',
      'border-radius': '4px',
      'text-align': 'center',
      ...props.style,
    }}
  >
    {props.children ?? 'Item'}
  </div>
)

export default (props: { Hst: any }) => {
  const { Hst } = props

  return (
    <Hst.Story title="Grid" group="layout">
      <Hst.Variant title="Basic Grid (3 columns)">
        <ThemeComparison>
          <Grid cols={3}>
            <Box>1</Box>
            <Box>2</Box>
            <Box>3</Box>
            <Box>4</Box>
            <Box>5</Box>
            <Box>6</Box>
          </Grid>
        </ThemeComparison>
      </Hst.Variant>

      <Hst.Variant title="Column Counts">
        <ThemeComparison>
          <div style={{ display: 'flex', 'flex-direction': 'column', gap: '1rem' }}>
            <div>
              <small>cols={2}</small>
              <Grid cols={2} gap="sm">
                <Box>1</Box>
                <Box>2</Box>
                <Box>3</Box>
                <Box>4</Box>
              </Grid>
            </div>
            <div>
              <small>cols={4}</small>
              <Grid cols={4} gap="sm">
                <Box>1</Box>
                <Box>2</Box>
                <Box>3</Box>
                <Box>4</Box>
              </Grid>
            </div>
            <div>
              <small>cols={6}</small>
              <Grid cols={6} gap="sm">
                <Box>1</Box>
                <Box>2</Box>
                <Box>3</Box>
                <Box>4</Box>
                <Box>5</Box>
                <Box>6</Box>
              </Grid>
            </div>
          </div>
        </ThemeComparison>
      </Hst.Variant>

      <Hst.Variant title="Auto-fit Grid">
        <ThemeComparison>
          <Grid cols="auto" gap="md">
            <Box>Card 1</Box>
            <Box>Card 2</Box>
            <Box>Card 3</Box>
            <Box>Card 4</Box>
            <Box>Card 5</Box>
          </Grid>
        </ThemeComparison>
      </Hst.Variant>

      <Hst.Variant title="Gap Sizes">
        <ThemeComparison>
          <div style={{ display: 'flex', 'flex-direction': 'column', gap: '1.5rem' }}>
            <div>
              <small>gap="xs"</small>
              <Grid cols={4} gap="xs">
                <Box>1</Box>
                <Box>2</Box>
                <Box>3</Box>
                <Box>4</Box>
              </Grid>
            </div>
            <div>
              <small>gap="md"</small>
              <Grid cols={4} gap="md">
                <Box>1</Box>
                <Box>2</Box>
                <Box>3</Box>
                <Box>4</Box>
              </Grid>
            </div>
            <div>
              <small>gap="xl"</small>
              <Grid cols={4} gap="xl">
                <Box>1</Box>
                <Box>2</Box>
                <Box>3</Box>
                <Box>4</Box>
              </Grid>
            </div>
          </div>
        </ThemeComparison>
      </Hst.Variant>

      <Hst.Variant title="GridItem Spanning">
        <ThemeComparison>
          <Grid cols={4} gap="md">
            <GridItem colSpan={2}>
              <Box>Span 2 cols</Box>
            </GridItem>
            <Box>1</Box>
            <Box>2</Box>
            <GridItem colSpan="full">
              <Box>Full width</Box>
            </GridItem>
            <Box>3</Box>
            <GridItem colSpan={3}>
              <Box>Span 3 cols</Box>
            </GridItem>
          </Grid>
        </ThemeComparison>
      </Hst.Variant>

      <Hst.Variant title="Row Spanning">
        <ThemeComparison>
          <Grid cols={3} gap="md">
            <GridItem rowSpan={2}>
              <Box style={{ height: '100%', 'min-height': '120px' }}>Span 2 rows</Box>
            </GridItem>
            <Box>1</Box>
            <Box>2</Box>
            <Box>3</Box>
            <Box>4</Box>
          </Grid>
        </ThemeComparison>
      </Hst.Variant>

      <Hst.Variant title="Dashboard Layout">
        <ThemeComparison>
          <Grid cols={4} gap="md">
            <GridItem colSpan="full">
              <Box style={{ background: 'var(--color-accent-primary)', color: 'var(--color-text-inverse)' }}>
                Header
              </Box>
            </GridItem>
            <GridItem colSpan={1} rowSpan={2}>
              <Box style={{ height: '100%' }}>Sidebar</Box>
            </GridItem>
            <GridItem colSpan={3}>
              <Box>Main Content</Box>
            </GridItem>
            <GridItem colSpan={3}>
              <Box>More Content</Box>
            </GridItem>
            <GridItem colSpan="full">
              <Box>Footer</Box>
            </GridItem>
          </Grid>
        </ThemeComparison>
      </Hst.Variant>
    </Hst.Story>
  )
}
