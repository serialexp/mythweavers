import { Button } from '@mythweavers/ui'
import { createSignal } from 'solid-js'

export default function Counter() {
  const [count, setCount] = createSignal(0)
  return (
    <Button variant="secondary" onClick={() => setCount(count() + 1)}>
      Clicks: {count()}
    </Button>
  )
}
