import { ErrorBoundary, For } from 'solid-js'
import { SceneTabs } from '../components/SceneTabs'
import { uiState } from '../lib/stores/ui'
import { ArcTabs } from './ArcTabs'
import { BookTabs } from './BookTabs'
import { ChapterTabs } from './ChapterTabs'

export const StoryPane = () => {
  return (
    <ErrorBoundary fallback={<div>Something went terribly wrong</div>}>
      <div class="flex flex-col flex-1 h-full bg-cover" style={{ 'background-image': 'url(/rice-paper.png)' }}>
        <div class="px-2 breadcrumbs text-sm">
          <ul>
            <For each={uiState.selectionPath}>{(path) => <li>{path.name}</li>}</For>
          </ul>
        </div>
        {uiState.selectedEntity === 'book' ? <BookTabs /> : null}
        {uiState.selectedEntity === 'arc' ? <ArcTabs /> : null}
        {uiState.selectedEntity === 'chapter' ? <ChapterTabs /> : null}
        {uiState.selectedEntity === 'scene' ? <SceneTabs /> : null}
      </div>
    </ErrorBoundary>
  )
}
