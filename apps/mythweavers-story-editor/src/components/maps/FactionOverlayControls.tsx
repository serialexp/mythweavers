import { Component, Show, Accessor, Setter, For } from "solid-js";
import { mapsStore } from "../../stores/mapsStore";
import { OverlayMethod } from "./types";
import { LANDMARK_STATE_FIELDS } from "../../types/core";
import styles from "../Maps.module.css";

interface FactionOverlayControlsProps {
  showFactionOverlay: Accessor<boolean>;
  setShowFactionOverlay: Setter<boolean>;
  overlayMethod: Accessor<OverlayMethod>;
  setOverlayMethod: Setter<OverlayMethod>;
  paintModeEnabled: Accessor<boolean>;
  setPaintModeEnabled: Setter<boolean>;
  selectedPaintFaction: Accessor<string | null>;
  setSelectedPaintFaction: Setter<string | null>;
}

/**
 * Controls for faction overlay visualization and paint mode on the map
 */
export const FactionOverlayControls: Component<FactionOverlayControlsProps> = (props) => {
  return (
    <Show when={mapsStore.selectedMap?.borderColor}>
      <div class={styles.overlayControls}>
        <label class={styles.overlayToggle}>
          <input
            type="checkbox"
            checked={props.showFactionOverlay()}
            onChange={(e) => props.setShowFactionOverlay(e.target.checked)}
          />
          <span>Faction Control</span>
        </label>
        <Show when={props.showFactionOverlay()}>
          <select
            class={styles.overlayMethodSelect}
            value={props.overlayMethod()}
            onChange={(e) => props.setOverlayMethod(e.target.value as OverlayMethod)}
          >
            <option value="voronoi">Standard Voronoi</option>
            <option value="metaball">Distance Field</option>
            <option value="blurred">Blurred Voronoi</option>
            <option value="noise" disabled>Noise (Coming Soon)</option>
          </select>
        </Show>
      </div>

      <div class={styles.paintControls}>
        <label class={styles.paintToggle}>
          <input
            type="checkbox"
            checked={props.paintModeEnabled()}
            onChange={(e) => props.setPaintModeEnabled(e.target.checked)}
          />
          <span>Paint Mode</span>
        </label>
        <Show when={props.paintModeEnabled()}>
          <select
            class={styles.paintFactionSelect}
            value={props.selectedPaintFaction() || ""}
            onChange={(e) => props.setSelectedPaintFaction(e.target.value || null)}
          >
            <option value="">Clear Allegiance</option>
            <For each={LANDMARK_STATE_FIELDS.allegiance.values}>
              {(option) => <option value={option.value}>{option.label}</option>}
            </For>
          </select>
        </Show>
      </div>
    </Show>
  );
};
