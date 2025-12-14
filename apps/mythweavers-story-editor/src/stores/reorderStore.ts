import { createSignal } from 'solid-js';

interface ReorderStore {
    isReorderMode: () => boolean;
    setIsReorderMode: (value: boolean) => void;
    toggleReorderMode: () => void;
}

function createReorderStore(): ReorderStore {
    const [isReorderMode, setIsReorderMode] = createSignal(false);

    return {
        isReorderMode,
        setIsReorderMode,
        toggleReorderMode: () => {
            setIsReorderMode(!isReorderMode());
        }
    };
}

export const reorderStore = createReorderStore();