import { Component, Show, Accessor, createMemo, For } from "solid-js";
import { Hyperlane, Landmark } from "../../types/core";
import styles from "./HyperlanePopup.module.css";

export interface HyperlanePopupProps {
  popupRef?: (el: HTMLDivElement) => void;
  selectedHyperlane: Accessor<Hyperlane | null>;
  popupPosition: Accessor<{ x: number; y: number }>;
  landmarks: Accessor<Landmark[]>;
  isEditing: Accessor<boolean>;
  isDeleting: Accessor<boolean>;
  isSaving: Accessor<boolean>;
  editSpeedMultiplier: Accessor<string>;
  setEditSpeedMultiplier: (value: string) => void;
  speedMultiplierError: Accessor<string>;
  onStartEditing: () => void;
  onSaveHyperlane: () => void;
  onCancelEditing: () => void;
  onDeleteHyperlane: () => void;
  onQuickSaveSpeedMultiplier?: (value: string) => void;
}

export const HyperlanePopup: Component<HyperlanePopupProps> = (props) => {
  // Get unique landmark IDs connected to this hyperlane
  const connectedLandmarks = createMemo(() => {
    const hyperlane = props.selectedHyperlane();
    if (!hyperlane) return [];

    const landmarkIds = new Set<string>();
    hyperlane.segments.forEach(segment => {
      if (segment.startLandmarkId) landmarkIds.add(segment.startLandmarkId);
      if (segment.endLandmarkId) landmarkIds.add(segment.endLandmarkId);
    });

    // Get landmark objects by ID
    const landmarksMap = new Map(props.landmarks().map(lm => [lm.id, lm]));
    return Array.from(landmarkIds)
      .map(id => landmarksMap.get(id))
      .filter((lm): lm is Landmark => lm !== undefined);
  });

  return (
    <Show when={props.selectedHyperlane()}>
      <div
        ref={props.popupRef}
        class={styles.popup}
        style={{
          left: `${props.popupPosition().x}px`,
          top: `${props.popupPosition().y}px`,
        }}
      >
        <Show
          when={!props.isEditing()}
          fallback={
            <div class={styles.editForm}>
              <h3>Edit Hyperlane</h3>

              <label>
                Speed Multiplier:
                <input
                  type="number"
                  step="0.1"
                  min="1.0"
                  max="20.0"
                  value={props.editSpeedMultiplier()}
                  onInput={(e) => props.setEditSpeedMultiplier(e.currentTarget.value)}
                  placeholder="10.0"
                />
                <Show when={props.speedMultiplierError()}>
                  <span class={styles.error}>{props.speedMultiplierError()}</span>
                </Show>
                <small>How much faster than normal space (1x - 20x)</small>
              </label>

              <div class={styles.buttonGroup}>
                <button
                  onClick={props.onSaveHyperlane}
                  disabled={props.isSaving()}
                  class={styles.saveButton}
                >
                  {props.isSaving() ? "Saving..." : "Save"}
                </button>
                <button
                  onClick={props.onCancelEditing}
                  class={styles.cancelButton}
                >
                  Cancel
                </button>
              </div>
            </div>
          }
        >
          <div class={styles.info}>
            <h3>Hyperlane</h3>
            <p>
              <strong>Speed Multiplier:</strong> {props.selectedHyperlane()!.speedMultiplier}x
            </p>
            <div class={styles.quickSelectGroup}>
              <button
                type="button"
                class={styles.quickSelectButton}
                onClick={() => props.onQuickSaveSpeedMultiplier?.("2.5")}
              >
                2.5x
              </button>
              <button
                type="button"
                class={styles.quickSelectButton}
                onClick={() => props.onQuickSaveSpeedMultiplier?.("5")}
              >
                5x
              </button>
              <button
                type="button"
                class={styles.quickSelectButton}
                onClick={() => props.onQuickSaveSpeedMultiplier?.("10")}
              >
                10x
              </button>
            </div>
            <p>
              <strong>Segments:</strong> {props.selectedHyperlane()!.segments.length}
            </p>

            <Show when={connectedLandmarks().length > 0}>
              <p>
                <strong>Connected to:</strong>
              </p>
              <ul class={styles.landmarkList}>
                <For each={connectedLandmarks()}>
                  {(landmark) => <li>{landmark.name}</li>}
                </For>
              </ul>
            </Show>

            <div class={styles.buttonGroup}>
              <button onClick={props.onStartEditing} class={styles.editButton}>
                Edit
              </button>
              <button
                onClick={props.onDeleteHyperlane}
                disabled={props.isDeleting()}
                class={styles.deleteButton}
              >
                {props.isDeleting() ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </Show>
      </div>
    </Show>
  );
};
