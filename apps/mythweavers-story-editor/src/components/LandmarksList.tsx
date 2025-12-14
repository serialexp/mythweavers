import { Component, For, Show, createMemo } from "solid-js";
import { BsArrowDown, BsArrowUp } from "solid-icons/bs";
import type { Landmark } from "../types/core";
import styles from "./LandmarksList.module.css";

interface LandmarksListProps {
  landmarks: Landmark[];
  selectedLandmark: Landmark | null;
  sortAscending: boolean;
  onSelectLandmark: (landmark: Landmark) => void;
  onToggleSort: () => void;
}

export const LandmarksList: Component<LandmarksListProps> = (props) => {
  const sortedLandmarks = createMemo(() => {
    const sorted = [...props.landmarks].sort((a, b) => {
      const aName = a.name.toLowerCase();
      const bName = b.name.toLowerCase();
      if (props.sortAscending) {
        return aName < bName ? -1 : aName > bName ? 1 : 0;
      } else {
        return aName > bName ? -1 : aName < bName ? 1 : 0;
      }
    });
    return sorted;
  });

  return (
    <div class={styles.landmarksList}>
      <div class={styles.landmarksListHeader}>
        Landmarks ({props.landmarks.length})
        <button class={styles.sortButton} onClick={props.onToggleSort}>
          {props.sortAscending ? <BsArrowDown /> : <BsArrowUp />} Sort
        </button>
      </div>
      <div class={styles.landmarksListContent}>
        <Show
          when={sortedLandmarks().length > 0}
          fallback={
            <div class={styles.emptyLandmarksList}>
              No landmarks yet. Click on the map to add one.
            </div>
          }
        >
          <For each={sortedLandmarks()}>
            {(landmark) => (
              <div
                class={`${styles.landmarkListItem} ${
                  props.selectedLandmark?.id === landmark.id
                    ? styles.selected
                    : ""
                }`}
                onClick={() => props.onSelectLandmark(landmark)}
              >
                <div
                  class={styles.landmarkColorDot}
                  style={{
                    "background-color": landmark.color || "#3498db",
                  }}
                />
                <div class={styles.landmarkListName}>{landmark.name}</div>
              </div>
            )}
          </For>
        </Show>
      </div>
    </div>
  );
};