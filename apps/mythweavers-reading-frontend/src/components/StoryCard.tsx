import { Component, Show } from 'solid-js';
import { A } from '@solidjs/router';
import { openAddToBookshelf } from '../lib/stores/bookshelf';

interface StoryCardProps {
  id: string;
  coverArtAsset?: string;
  name: string;
  summary: string;
  color?: string;
  textColor?: string;
  pages: number;
  fontFamily?: string;
  lastChapterReleasedAt?: string;
  spellingLevel?: number;
  royalRoadId?: number;
  status?: string;
  wordsPerWeek?: number;
  canAddToLibrary?: boolean;
}

const StoryCard: Component<StoryCardProps> = (props) => {
  const handleAddToLibraryClick = () => {
    openAddToBookshelf(props.id);
  };

  return (
    <div class="card-container relative">
      <div 
        class="card bg-base-100 shadow-xl transition-all hover:scale-105"
        style={{ 
          "--thickness": `${Math.round(props.pages / 20)}px`,
          "background-color": props.color || 'var(--card-bg)',
          "color": props.textColor || 'var(--card-text)'
        }}
      >
        <div class="card-front relative overflow-hidden h-64">
          <Show when={props.coverArtAsset} fallback={
            <p class="text-center text-gray-500 self-start mt-8 px-4 text-xl font-bold"
               style={{ "font-family": props.fontFamily || 'inherit' }}>
              {props.name}
            </p>
          }>
            <img 
              src={props.coverArtAsset} 
              alt={props.name} 
              class="w-full h-full object-cover"
            />
          </Show>
        </div>
        
        <div class="card-body">
          <h2 class="card-title">{props.name}</h2>
          <p class="text-xs overflow-x-hidden w-full">
            {props.pages} pages
            {props.status === "COMPLETED" ? " ✅" : 
             props.status === "HIATUS" ? " ⏸️" : " 🔥"}{" "}
            {props.wordsPerWeek ?? "?"} W/W
          </p>
          <div 
            class="text-xs flex-1 overflow-x-hidden w-full"
            innerHTML={props.summary}
          />
          
          <div class="card-actions justify-around">
            <Show when={props.canAddToLibrary}>
              <button
                type="button"
                class="btn btn-accent btn-sm"
                onClick={handleAddToLibraryClick}
              >
                + Library
              </button>
            </Show>
            
            <Show when={props.royalRoadId} fallback={
              <A href={`/story/${props.id}`} class="btn btn-primary btn-sm">
                Read
              </A>
            }>
              <a
                class="btn btn-primary btn-sm"
                href={`https://www.royalroad.com/fiction/${props.royalRoadId}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                Read on RR
              </a>
            </Show>
          </div>
        </div>
      </div>
      
      <div class="text-lg text-gray-500 mt-4 flex items-center justify-center gap-1">
        <span title={
          props.status === "COMPLETED" ? "Completed" : 
          props.status === "HIATUS" ? "Hiatus" : "Ongoing"
        }>
          {props.status === "COMPLETED" ? " ✅" : 
           props.status === "HIATUS" ? " ⏸️" : " 🔥"}
        </span>
      </div>
    </div>
  );
};

export default StoryCard;