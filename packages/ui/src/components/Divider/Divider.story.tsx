import { ThemeComparison } from '../../story-utils/ThemeComparison'
import { HStack, VStack } from '../Stack'
import { Divider } from './Divider'

export default (props: { Hst: any }) => {
  const { Hst } = props

  return (
    <Hst.Story title="Divider" group="layout">
      <Hst.Variant title="Horizontal (default)">
        <ThemeComparison>
          <VStack gap="none">
            <p>Content above</p>
            <Divider spacing="md" />
            <p>Content below</p>
          </VStack>
        </ThemeComparison>
      </Hst.Variant>

      <Hst.Variant title="Vertical">
        <ThemeComparison>
          <HStack align="stretch" style={{ height: '60px' }}>
            <span>Left</span>
            <Divider orientation="vertical" spacing="md" />
            <span>Right</span>
          </HStack>
        </ThemeComparison>
      </Hst.Variant>

      <Hst.Variant title="Variants">
        <ThemeComparison>
          <VStack gap="lg">
            <div>
              <small>variant="solid"</small>
              <Divider variant="solid" />
            </div>
            <div>
              <small>variant="dashed"</small>
              <Divider variant="dashed" />
            </div>
            <div>
              <small>variant="dotted"</small>
              <Divider variant="dotted" />
            </div>
          </VStack>
        </ThemeComparison>
      </Hst.Variant>

      <Hst.Variant title="Colors">
        <ThemeComparison>
          <VStack gap="lg">
            <div>
              <small>color="subtle"</small>
              <Divider color="subtle" />
            </div>
            <div>
              <small>color="default"</small>
              <Divider color="default" />
            </div>
            <div>
              <small>color="strong"</small>
              <Divider color="strong" />
            </div>
          </VStack>
        </ThemeComparison>
      </Hst.Variant>

      <Hst.Variant title="Spacing">
        <ThemeComparison>
          <VStack gap="none" style={{ background: 'var(--color-bg-raised)', padding: '0.5rem' }}>
            <p>No spacing</p>
            <Divider spacing="none" />
            <p>Small spacing</p>
            <Divider spacing="sm" />
            <p>Medium spacing</p>
            <Divider spacing="md" />
            <p>Large spacing</p>
            <Divider spacing="lg" />
            <p>End</p>
          </VStack>
        </ThemeComparison>
      </Hst.Variant>

      <Hst.Variant title="In Toolbar">
        <ThemeComparison>
          <HStack
            align="center"
            gap="sm"
            style={{ padding: '0.5rem', background: 'var(--color-bg-raised)', 'border-radius': '4px' }}
          >
            <button>Cut</button>
            <button>Copy</button>
            <button>Paste</button>
            <Divider orientation="vertical" spacing="sm" />
            <button>Undo</button>
            <button>Redo</button>
            <Divider orientation="vertical" spacing="sm" />
            <button>Settings</button>
          </HStack>
        </ThemeComparison>
      </Hst.Variant>

      <Hst.Variant title="In List">
        <ThemeComparison>
          <VStack
            gap="none"
            style={{ background: 'var(--color-bg-raised)', padding: '0.5rem', 'border-radius': '4px' }}
          >
            <div style={{ padding: '0.5rem' }}>List item 1</div>
            <Divider color="subtle" />
            <div style={{ padding: '0.5rem' }}>List item 2</div>
            <Divider color="subtle" />
            <div style={{ padding: '0.5rem' }}>List item 3</div>
          </VStack>
        </ThemeComparison>
      </Hst.Variant>
    </Hst.Story>
  )
}
