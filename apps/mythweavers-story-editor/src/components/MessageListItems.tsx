import { Match, Switch } from "solid-js";
import { viewModeStore } from "../stores/viewModeStore";
import { NormalModeView } from "./NormalModeView";
import { ScriptModeView } from "./ScriptModeView";
import { ReorderModeView } from "./ReorderModeView";
import { ReadModeView } from "./ReadModeView";

interface MessageListItemsProps {
    isGenerating: boolean;
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
    );
}