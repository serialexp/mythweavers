import { Match, Switch } from 'solid-js'
import { viewModeStore } from '../stores/viewModeStore'
import { NormalModeView } from './NormalModeView'
import { ReadModeView } from './ReadModeView'
import { ReorderModeView } from './ReorderModeView'
import { ScriptModeView } from './ScriptModeView'

interface MessageListItemsProps {
  isGenerating: boolean
}

export default function MessageListItems(props: MessageListItemsProps) {
  return (
    <Switch>
      <Match when={viewModeStore.isReorderMode()}>
        <ReorderModeView isGenerating={props.isGenerating} />
      </Match>
      <Match when={viewModeStore.isScriptMode()}>
        <ScriptModeView isGenerating={props.isGenerating} />
      </Match>
      <Match when={viewModeStore.isReadMode()}>
        <ReadModeView isGenerating={props.isGenerating} />
      </Match>
      <Match when={true}>
        <NormalModeView isGenerating={props.isGenerating} />
      </Match>
    </Switch>
  )
}
