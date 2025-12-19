import { ErrorBoundary, createSignal } from 'solid-js'
import { SceneHistoryPanel } from './SceneHistoryPanel'
import { ScenePanel } from './ScenePanel'
import { StoryPanel } from './StoryPanel'
// import { ScenePanel } from "../components/ScenePanel";
// import { StoryPanel } from "./StoryPanel.tsx";
// import { SceneHistoryPanel } from "./SceneHistoryPanel.tsx";

export const SceneTabs = () => {
  const [activeTab, setActiveTab] = createSignal(0)

  return (
    <div class="flex flex-col flex-1 overflow-hidden">
      <div class="tabs tabs-bordered">
        <button type="button" class={`tab ${activeTab() === 0 ? 'tab-active' : ''}`} onClick={() => setActiveTab(0)}>
          Story
        </button>
        <button type="button" class={`tab ${activeTab() === 1 ? 'tab-active' : ''}`} onClick={() => setActiveTab(1)}>
          Scene
        </button>
        <button type="button" class={`tab ${activeTab() === 2 ? 'tab-active' : ''}`} onClick={() => setActiveTab(2)}>
          History
        </button>
      </div>

      <div class="flex-1 overflow-hidden flex flex-col">
        {activeTab() === 0 && (
          <div class="flex-1 p-0 overflow-hidden">
            <ErrorBoundary fallback={<div>Something went terribly wrong</div>}>
              <StoryPanel />
            </ErrorBoundary>
          </div>
        )}
        {activeTab() === 1 && (
          <div class="flex-1 p-0 overflow-hidden">
            <ErrorBoundary fallback={<div>Something went terribly wrong</div>}>
              <ScenePanel />
            </ErrorBoundary>
          </div>
        )}
        {activeTab() === 2 && (
          <div class="flex-1 p-0 overflow-hidden">
            <ErrorBoundary fallback={<div>Something went terribly wrong</div>}>
              <SceneHistoryPanel />
            </ErrorBoundary>
          </div>
        )}
      </div>
    </div>
  )
}
