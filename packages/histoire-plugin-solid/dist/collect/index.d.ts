import type { ServerRunPayload, ServerStory } from '@histoire/shared';
import { type ParentComponent } from 'solid-js';
export declare const Story: ParentComponent<{
    title?: string;
    id?: string;
    group?: string;
    layout?: ServerStory['layout'];
    icon?: string;
    iconColor?: string;
    docsOnly?: boolean;
}>;
export declare const Variant: ParentComponent<{
    title?: string;
    id?: string;
    icon?: string;
    iconColor?: string;
    source?: string;
}>;
export declare function run({ file, storyData }: ServerRunPayload): Promise<void>;
