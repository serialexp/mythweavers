import { Component, Show } from "solid-js";
import { BsCheck, BsX, BsPencil, BsTrash } from "solid-icons/bs";
import { AiOutlineLoading3Quarters } from "solid-icons/ai";
import { EJSRenderer } from "./EJSRenderer";
import type { Landmark } from "../types/core";
import styles from "./LandmarkPopup.module.css";

interface LandmarkPopupProps {
  selectedLandmark: Landmark | null;
  isAddingNew: boolean;
  isEditing: boolean;
  isSaving: boolean;
  editName: string;
  editDescription: string;
  editColor: string;
  editSize: "small" | "medium" | "large";
  position: { x: number; y: number };
  onEditName: (name: string) => void;
  onEditDescription: (description: string) => void;
  onEditColor: (color: string) => void;
  onEditSize: (size: "small" | "medium" | "large") => void;
  onSave: () => void;
  onCancel: () => void;
  onStartEdit: () => void;
  onDelete: () => void;
  ref?: (el: HTMLDivElement) => void;
}

export const LandmarkPopup: Component<LandmarkPopupProps> = (props) => {
  const colorOptions = [
    "#e74c3c", // Red
    "#e67e22", // Orange
    "#f39c12", // Yellow
    "#2ecc71", // Green
    "#3498db", // Blue
    "#9b59b6", // Purple
    "#1abc9c", // Turquoise
    "#34495e", // Dark gray
    "#ffffff", // White
  ];

  return (
    <Show when={props.selectedLandmark || props.isAddingNew}>
      <div
        ref={props.ref}
        class={styles.landmarkPopup}
        style={{
          left: `${props.position.x}px`,
          top: `${props.position.y}px`,
        }}
      >
        <div class={styles.landmarkPopupContent}>
          <Show
            when={props.isEditing}
            fallback={
              <>
                <Show when={props.selectedLandmark}>
                  <div class={styles.landmarkName}>
                    <EJSRenderer template={props.selectedLandmark!.name} mode="inline" />
                  </div>
                  <div class={styles.landmarkDescription}>
                    <EJSRenderer
                      template={props.selectedLandmark!.description || ""}
                      mode="inline"
                    />
                  </div>
                  <div class={styles.landmarkActions}>
                    <button
                      class={styles.landmarkButton}
                      onClick={props.onStartEdit}
                    >
                      <BsPencil /> Edit
                    </button>
                    <button
                      class={`${styles.landmarkButton} ${styles.delete}`}
                      onClick={props.onDelete}
                    >
                      <BsTrash /> Delete
                    </button>
                  </div>
                </Show>
              </>
            }
          >
            <div class={styles.landmarkEditForm}>
              <input
                type="text"
                class={styles.landmarkInput}
                placeholder="Landmark name"
                value={props.editName}
                onInput={(e) => props.onEditName(e.currentTarget.value)}
              />
              <textarea
                class={styles.landmarkTextarea}
                placeholder="Description (optional)"
                value={props.editDescription}
                onInput={(e) =>
                  props.onEditDescription(e.currentTarget.value)
                }
              />

              {/* Color picker */}
              <div class={styles.colorPicker}>
                <div class={styles.colorPickerRow}>
                  <span class={styles.colorPickerLabel}>Color:</span>
                  <input
                    type="color"
                    class={styles.colorInput}
                    value={props.editColor}
                    onInput={(e) => props.onEditColor(e.currentTarget.value)}
                  />
                </div>
                <div class={styles.colorQuickPicks}>
                  {colorOptions.map((color) => (
                    <button
                      class={`${styles.colorQuickPick} ${
                        props.editColor === color ? styles.selected : ""
                      } ${color === "#ffffff" ? styles.white : ""}`}
                      style={{ "background-color": color }}
                      onClick={() => props.onEditColor(color)}
                    />
                  ))}
                </div>
              </div>

              {/* Size picker */}
              <div class={styles.sizePicker}>
                <span class={styles.sizePickerLabel}>Size:</span>
                <div class={styles.sizeButtons}>
                  <button
                    class={`${styles.sizeButton} ${
                      props.editSize === "small" ? styles.selected : ""
                    }`}
                    onClick={() => props.onEditSize("small")}
                  >
                    Small
                  </button>
                  <button
                    class={`${styles.sizeButton} ${
                      props.editSize === "medium" ? styles.selected : ""
                    }`}
                    onClick={() => props.onEditSize("medium")}
                  >
                    Medium
                  </button>
                  <button
                    class={`${styles.sizeButton} ${
                      props.editSize === "large" ? styles.selected : ""
                    }`}
                    onClick={() => props.onEditSize("large")}
                  >
                    Large
                  </button>
                </div>
              </div>

              <div class={styles.landmarkFormActions}>
                <button
                  class={styles.landmarkSaveButton}
                  onClick={props.onSave}
                  disabled={!props.editName.trim() || props.isSaving}
                >
                  <Show
                    when={!props.isSaving}
                    fallback={
                      <>
                        <AiOutlineLoading3Quarters class="animate-spin" />{" "}
                        Saving...
                      </>
                    }
                  >
                    <BsCheck /> Save
                  </Show>
                </button>
                <button
                  class={styles.landmarkCancelButton}
                  onClick={props.onCancel}
                >
                  <BsX /> Cancel
                </button>
              </div>
            </div>
          </Show>
        </div>
      </div>
    </Show>
  );
};