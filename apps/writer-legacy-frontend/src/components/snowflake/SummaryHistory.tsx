import type { Node } from '@writer/shared'
import { For } from 'solid-js'

interface Props {
  summaries: NonNullable<Node['summaries']>
}

export const SummaryHistory = (props: Props) => {
  return (
    <div class="pl-4 border-l-2 border-gray-300 space-y-2">
      <For each={[...props.summaries].reverse()}>
        {(summary) => (
          <div class="text-sm">
            <div class="text-xs text-gray-500">
              Level {summary.level} • {new Date(summary.timestamp).toLocaleString()}
            </div>
            <div>{summary.text}</div>
          </div>
        )}
      </For>
    </div>
  )
}
