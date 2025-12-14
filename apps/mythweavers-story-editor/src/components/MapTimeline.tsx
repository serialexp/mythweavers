import { Component, Show } from "solid-js";
import styles from "./MapTimeline.module.css";

interface MapTimelineProps {
  hasTimeline: boolean;
  timelinePosition: number;
  maxPosition: number;
  onPositionChange: (position: number) => void;
  onReset: () => void;
}

export const MapTimeline: Component<MapTimelineProps> = (props) => {
  return (
    <Show when={props.hasTimeline}>
      <div class={styles.timelineSection}>
        <div class={styles.timelineHeader}>
          <span>
            Timeline: {props.timelinePosition} / {props.maxPosition}
          </span>
          <button
            class={styles.resetTimelineButton}
            onClick={props.onReset}
            disabled={props.timelinePosition >= props.maxPosition}
          >
            Reset to Latest
          </button>
        </div>
        <input
          type="range"
          class={styles.timelineSlider}
          min="0"
          max={props.maxPosition}
          value={props.timelinePosition}
          onInput={(e) =>
            props.onPositionChange(parseInt(e.currentTarget.value))
          }
        />
      </div>
    </Show>
  );
};